const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classificarTermo, buscarPorPaciente } = require('../../lib/aplis/consultas');
const { AplisError } = require('../../lib/aplis/client');

const HOJE = new Date('2026-09-14T12:00:00Z');

function item(over) {
  return {
    CodRequisicao: '0210029277004', DtaSolicitacao: '01/09/2026 09:00', DtaFinalizacao: '', DtaPrevista: '20/09/2026',
    CodPaciente: 555, NomPaciente: 'MARIA DA SILVA', CPF: '12345678901', NomExame: 'Citologia',
    DesEvento: 'Em análise', StatusExame: 0, CodPrioridade: 0, ...over
  };
}

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

test('classificarTermo reconhece código de 13 dígitos, CPF de 11 e nome', () => {
  assert.deepEqual(classificarTermo('0210029277004'), { tipo: 'codigo', valor: '0210029277004' });
  assert.deepEqual(classificarTermo('123.456.789-01'), { tipo: 'cpf', valor: '12345678901' });
  assert.deepEqual(classificarTermo('12345678901'), { tipo: 'cpf', valor: '12345678901' });
  assert.deepEqual(classificarTermo('  Maria da Silva '), { tipo: 'nome', valor: 'Maria da Silva' });
});

test('classificarTermo rejeita termo curto ou vazio', () => {
  assert.equal(classificarTermo(''), null);
  assert.equal(classificarTermo('ab'), null);
  assert.equal(classificarTermo('12'), null);
  assert.equal(classificarTermo(null), null);
});

test('buscarPorPaciente usa janela de 90 dias por padrão e 24 meses ao ampliar', async () => {
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista: [] } });
  await buscarPorPaciente(client, 'Maria', { hoje: HOJE });
  assert.deepEqual(client.chamadas[0].dat, {
    tipoData: 1, periodoIni: '2026-06-16', periodoFim: '2026-09-14', nomPaciente: 'Maria', pagina: 1, tamanho: 50
  });

  await buscarPorPaciente(client, 'Maria', { hoje: HOJE, ampliar: true });
  assert.equal(client.chamadas[1].dat.periodoIni, '2024-09-14');
});

test('busca por CPF envia só os dígitos', async () => {
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista: [] } });
  await buscarPorPaciente(client, '123.456.789-01', { hoje: HOJE });
  assert.equal(client.chamadas[0].dat.nomPaciente, '12345678901');
});

test('sem resultado devolve encontrado=false com a janela consultada', async () => {
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista: [] } });
  const r = await buscarPorPaciente(client, 'Maria', { hoje: HOJE });
  assert.deepEqual(r, { encontrado: false, termo: 'Maria', tipo: 'nome', janelaDias: 90, total: 0, truncado: false, pacientes: [] });
  const r2 = await buscarPorPaciente(client, 'Maria', { hoje: HOJE, ampliar: true });
  assert.equal(r2.janelaDias, 730);
});

test('um único paciente: agrupa suas requisições, mais recente primeiro, e busca o status dela', async () => {
  const lista = [
    item({ CodRequisicao: '0210029277001', DtaSolicitacao: '10/07/2026 09:00' }),
    item({ CodRequisicao: '0210029277002', DtaSolicitacao: '01/09/2026 09:00' }),
    item({ CodRequisicao: '0210029277003', DtaSolicitacao: '15/08/2026 09:00' })
  ];
  const client = clientFake({
    requisicaoListar: { sucesso: 1, lista },
    requisicaoStatus: { sucesso: 1, historico: [{ data: '02/09/2026 10:00', descricao: 'x', descricaoCliente: 'Em análise no laboratório' }] }
  });
  const r = await buscarPorPaciente(client, 'Maria', { hoje: HOJE });

  assert.equal(r.encontrado, true);
  assert.equal(r.pacientes.length, 1);
  const p = r.pacientes[0];
  assert.equal(p.codPaciente, 555);
  assert.equal(p.paciente, 'MARIA DA SILVA');
  assert.equal(p.cpfFinal, '8901');
  assert.deepEqual(p.requisicoes.map((q) => q.codRequisicao), ['0210029277002', '0210029277003', '0210029277001']);
  assert.equal(p.requisicoes[0].statusCliente, 'Em análise no laboratório');
  assert.equal(p.requisicoes[1].statusCliente, undefined);
  assert.equal(client.chamadas.filter((c) => c.cmd === 'requisicaoStatus').length, 1);
  assert.deepEqual(client.chamadas[1].dat, { codRequisicao: '0210029277002' });
});

test('vários pacientes: agrupa por CodPaciente e NÃO consulta status de ninguém', async () => {
  const lista = [
    item({ CodRequisicao: '1', CodPaciente: 1, NomPaciente: 'MARIA DA SILVA', CPF: '11111111111' }),
    item({ CodRequisicao: '2', CodPaciente: 2, NomPaciente: 'MARIA DA SILVA', CPF: '22222222222', DtaSolicitacao: '05/09/2026 08:00' }),
    item({ CodRequisicao: '3', CodPaciente: 1, NomPaciente: 'MARIA DA SILVA', CPF: '11111111111', DtaSolicitacao: '08/09/2026 08:00' })
  ];
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista } });
  const r = await buscarPorPaciente(client, 'Maria', { hoje: HOJE });

  assert.equal(r.pacientes.length, 2);
  assert.equal(client.chamadas.filter((c) => c.cmd === 'requisicaoStatus').length, 0);
  const p1 = r.pacientes.find((p) => p.codPaciente === 1);
  assert.equal(p1.requisicoes.length, 2);
  assert.equal(p1.requisicoes[0].codRequisicao, '3');
  assert.equal(p1.cpfFinal, '1111');
});

test('sinaliza truncamento quando o apLIS tem mais registros do que a página devolvida', async () => {
  const lista = [item({ CodRequisicao: '1', CodPaciente: 1 }), item({ CodRequisicao: '2', CodPaciente: 2 })];
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista, registros: '137', qtdPaginas: 3 } });
  const r = await buscarPorPaciente(client, 'Maria', { hoje: HOJE });
  assert.equal(r.total, 137);
  assert.equal(r.truncado, true);

  const client2 = clientFake({ requisicaoListar: { sucesso: 1, lista, registros: '2', qtdPaginas: 1 } });
  const r2 = await buscarPorPaciente(client2, 'Maria', { hoje: HOJE });
  assert.equal(r2.total, 2);
  assert.equal(r2.truncado, false);
});

test('pacientes vêm ordenados pela requisição mais recente', async () => {
  const lista = [
    item({ CodRequisicao: '1', CodPaciente: 1, DtaSolicitacao: '01/07/2026 08:00' }),
    item({ CodRequisicao: '2', CodPaciente: 2, DtaSolicitacao: '10/09/2026 08:00' })
  ];
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista } });
  const r = await buscarPorPaciente(client, 'Maria', { hoje: HOJE });
  assert.deepEqual(r.pacientes.map((p) => p.codPaciente), [2, 1]);
});

test('falha no status do paciente único não derruba a busca', async () => {
  const client = clientFake({
    requisicaoListar: { sucesso: 1, lista: [item()] },
    requisicaoStatus: new AplisError('timeout', 'demorou')
  });
  const r = await buscarPorPaciente(client, 'Maria', { hoje: HOJE });
  assert.equal(r.encontrado, true);
  assert.equal(r.pacientes[0].requisicoes[0].statusCliente, null);
});

test('itens que não batem com o nome buscado são descartados (defesa contra filtro não-estrito)', async () => {
  const lista = [
    item({ CodRequisicao: '1', CodPaciente: 1, NomPaciente: 'MARIA APARECIDA' }),
    item({ CodRequisicao: '2', CodPaciente: 2, NomPaciente: 'JOSÉ CARLOS' }),
    item({ CodRequisicao: '3', CodPaciente: 3, NomPaciente: 'Ana Maria Souza' })
  ];
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista } });
  const r = await buscarPorPaciente(client, 'maria', { hoje: HOJE });
  assert.deepEqual(r.pacientes.map((p) => p.codPaciente).sort(), [1, 3]);
});

test('busca por nome ignora acentos e caixa ao conferir os itens', async () => {
  const lista = [item({ CodRequisicao: '1', CodPaciente: 1, NomPaciente: 'JOSÉ ANTÔNIO' })];
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista } });
  const r = await buscarPorPaciente(client, 'jose antonio', { hoje: HOJE });
  assert.equal(r.encontrado, true);
  assert.equal(r.pacientes.length, 1);
});

test('itens cujo CPF não é o buscado são descartados', async () => {
  const lista = [
    item({ CodRequisicao: '1', CodPaciente: 1, CPF: '12345678901' }),
    item({ CodRequisicao: '2', CodPaciente: 2, CPF: '99999999999' })
  ];
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista } });
  const r = await buscarPorPaciente(client, '123.456.789-01', { hoje: HOJE });
  assert.equal(r.pacientes.length, 1);
  assert.equal(r.pacientes[0].codPaciente, 1);
});

test('lista cheia só de itens que não batem vira encontrado=false', async () => {
  const lista = [item({ CodRequisicao: '1', CodPaciente: 1, NomPaciente: 'OUTRA PESSOA' })];
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista, registros: '1' } });
  const r = await buscarPorPaciente(client, 'Maria', { hoje: HOJE });
  assert.equal(r.encontrado, false);
  assert.equal(client.chamadas.filter((c) => c.cmd === 'requisicaoStatus').length, 0);
});

test('itens sem CodPaciente e sem nome não são fundidos num paciente só', async () => {
  const lista = [
    item({ CodRequisicao: '1', CodPaciente: null, NomPaciente: null, CPF: '12345678901' }),
    item({ CodRequisicao: '2', CodPaciente: null, NomPaciente: null, CPF: '12345678901' })
  ];
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista } });
  const r = await buscarPorPaciente(client, '12345678901', { hoje: HOJE });
  assert.equal(r.pacientes.length, 2);
});

test('termo inválido é rejeitado sem chamar o apLIS', async () => {
  const client = clientFake({});
  await assert.rejects(() => buscarPorPaciente(client, 'ab', { hoje: HOJE }), { tipo: 'entrada_invalida' });
  assert.equal(client.chamadas.length, 0);
});
