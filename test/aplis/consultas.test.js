const { test } = require('node:test');
const assert = require('node:assert/strict');
const { consultarPorCodigo, formatarDataAplis } = require('../../lib/aplis/consultas');
const { AplisError } = require('../../lib/aplis/client');

const HOJE = new Date('2026-09-14T12:00:00Z');
const COD = '0210029277004';

const itemListar = {
  CodRequisicao: COD, DtaSolicitacao: '31/08/2026 09:12:00', DtaFinalizacao: '', DtaPrevista: '20/09/2026',
  CodPaciente: 555, NomPaciente: 'MARIA DA SILVA', CPF: '12345678901', NomExame: 'Citologia',
  DesEvento: 'Em análise', StatusExame: 0, CodPrioridade: 0
};

function clientFake(respostas) {
  const chamadas = [];
  return {
    chamadas,
    chamar: async (cmd, dat) => {
      chamadas.push({ cmd, dat });
      const r = respostas[cmd];
      if (typeof r === 'function') return r(dat);
      if (r instanceof Error) throw r;
      return r;
    }
  };
}

test('formatarDataAplis produz AAAA-MM-DD', () => {
  assert.equal(formatarDataAplis(HOJE), '2026-09-14');
});

test('código fora do formato de 13 dígitos é rejeitado sem chamar o apLIS', async () => {
  const client = clientFake({});
  for (const ruim of ['123', 'abc', '', '02100292770045', '0210-029277004']) {
    await assert.rejects(() => consultarPorCodigo(client, ruim, { hoje: HOJE }), { tipo: 'entrada_invalida' });
  }
  assert.equal(client.chamadas.length, 0);
});

test('consulta lista por código com janela de 24 meses e depois busca o status', async () => {
  const client = clientFake({
    requisicaoListar: { sucesso: 1, lista: [itemListar] },
    requisicaoStatus: { sucesso: 1, historico: [{ data: '2026-09-01 10:00:00', descricao: 'Macro', descricaoCliente: 'Em análise no laboratório' }] }
  });
  const r = await consultarPorCodigo(client, COD, { hoje: HOJE });

  assert.equal(client.chamadas[0].cmd, 'requisicaoListar');
  assert.deepEqual(client.chamadas[0].dat, {
    tipoData: 1, periodoIni: '2024-09-14', periodoFim: '2026-09-14', codRequisicao: COD, pagina: 1, tamanho: 5
  });
  assert.equal(client.chamadas[1].cmd, 'requisicaoStatus');
  assert.deepEqual(client.chamadas[1].dat, { codRequisicao: COD });

  assert.equal(r.encontrado, true);
  assert.equal(r.requisicao.codRequisicao, COD);
  assert.equal(r.requisicao.paciente, 'MARIA DA SILVA');
  assert.equal(r.requisicao.exame, 'Citologia');
  assert.equal(r.requisicao.dtaPrevista, '20/09/2026');
  assert.equal(r.requisicao.statusCliente, 'Em análise no laboratório');
});

test('lista vazia devolve encontrado=false e não consulta status', async () => {
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista: [] } });
  const r = await consultarPorCodigo(client, COD, { hoje: HOJE });
  assert.deepEqual(r, { encontrado: false, codRequisicao: COD });
  assert.equal(client.chamadas.length, 1);
});

test('lista sem o código exato devolve encontrado=false, mesmo que venha cheia de outras requisições', async () => {
  const outras = ['0210029277001', '0210029277002', '0210029277003'].map((c) => ({ ...itemListar, CodRequisicao: c, NomPaciente: 'OUTRA PESSOA' }));
  const client = clientFake({
    requisicaoListar: { sucesso: 1, lista: outras },
    requisicaoStatus: { sucesso: 1, historico: [] }
  });
  const r = await consultarPorCodigo(client, COD, { hoje: HOJE });
  assert.deepEqual(r, { encontrado: false, codRequisicao: COD });
  assert.equal(client.chamadas.length, 1, 'não deve consultar status de uma requisição que não é a pedida');
});

test('escolhe o item cujo código bate exatamente, ignorando outros da lista', async () => {
  const outro = { ...itemListar, CodRequisicao: '0210029277099', NomPaciente: 'OUTRA PESSOA' };
  const client = clientFake({
    requisicaoListar: { sucesso: 1, lista: [outro, itemListar] },
    requisicaoStatus: { sucesso: 1, historico: [] }
  });
  const r = await consultarPorCodigo(client, COD, { hoje: HOJE });
  assert.equal(r.requisicao.paciente, 'MARIA DA SILVA');
});

test('falha no requisicaoStatus não derruba a consulta: statusCliente fica nulo', async () => {
  const client = clientFake({
    requisicaoListar: { sucesso: 1, lista: [itemListar] },
    requisicaoStatus: new AplisError('timeout', 'demorou')
  });
  const r = await consultarPorCodigo(client, COD, { hoje: HOJE });
  assert.equal(r.encontrado, true);
  assert.equal(r.requisicao.statusCliente, null);
  assert.equal(r.requisicao.status, 'Em análise');
});

test('erro no requisicaoListar propaga', async () => {
  const client = clientFake({ requisicaoListar: new AplisError('negocio', 'Período inválido', { codErro: 7 }) });
  await assert.rejects(() => consultarPorCodigo(client, COD, { hoje: HOJE }), { tipo: 'negocio', codErro: 7 });
});
