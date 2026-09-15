const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarFerramentasProcesso } = require('../../lib/processos/ferramentas');

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
      return r;
    }
  };
}

test('prioriza código de requisição quando presente', async () => {
  const client = clientFake({
    requisicaoListar: { sucesso: 1, lista: [item()] },
    requisicaoStatus: { sucesso: 1, historico: [] }
  });
  const ferramentas = criarFerramentasProcesso({ aplisClient: client });
  const r = await ferramentas.consultarPaciente({ codRequisicao: '0210029277004', cpf: '99999999999' });

  assert.equal(r.encontrado, true);
  assert.equal(r.multiplos, false);
  assert.equal(r.situacao.paciente, 'MARIA DA SILVA');
  assert.equal(r.situacao.exame, 'Citologia');
  assert.equal(r.situacao.dtaPrevista, '20/09/2026');
  assert.equal(client.chamadas[0].dat.codRequisicao, '0210029277004');
});

test('sem código, usa CPF', async () => {
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista: [item()] }, requisicaoStatus: { sucesso: 1, historico: [] } });
  const ferramentas = criarFerramentasProcesso({ aplisClient: client });
  const r = await ferramentas.consultarPaciente({ cpf: '12345678901', nome: 'ignorado' });
  assert.equal(r.encontrado, true);
  assert.equal(client.chamadas[0].dat.nomPaciente, '12345678901');
});

test('sem código nem CPF, usa nome', async () => {
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista: [item()] }, requisicaoStatus: { sucesso: 1, historico: [] } });
  const ferramentas = criarFerramentasProcesso({ aplisClient: client });
  const r = await ferramentas.consultarPaciente({ nome: 'Maria da Silva' });
  assert.equal(r.encontrado, true);
  assert.equal(client.chamadas[0].dat.nomPaciente, 'Maria da Silva');
});

test('busca por paciente com um único resultado: multiplos=false e situacao unificada', async () => {
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista: [item()] }, requisicaoStatus: { sucesso: 1, historico: [{ data: '02/09/2026 10:00', descricao: 'x', descricaoCliente: 'Em análise no laboratório' }] } });
  const ferramentas = criarFerramentasProcesso({ aplisClient: client });
  const r = await ferramentas.consultarPaciente({ cpf: '12345678901' });
  assert.equal(r.multiplos, false);
  assert.equal(r.situacao.statusCliente, 'Em análise no laboratório');
});

test('busca por paciente com múltiplos resultados: multiplos=true e pacientes expostos, sem situacao', async () => {
  const lista = [item({ CodRequisicao: '1', CodPaciente: 1 }), item({ CodRequisicao: '2', CodPaciente: 2 })];
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista } });
  const ferramentas = criarFerramentasProcesso({ aplisClient: client });
  const r = await ferramentas.consultarPaciente({ nome: 'Maria' });
  assert.equal(r.multiplos, true);
  assert.equal(r.pacientes.length, 2);
  assert.equal(r.situacao, undefined);
});

test('não encontrado por código', async () => {
  const client = clientFake({ requisicaoListar: { sucesso: 1, lista: [] } });
  const ferramentas = criarFerramentasProcesso({ aplisClient: client });
  const r = await ferramentas.consultarPaciente({ codRequisicao: '0000000000000' });
  assert.equal(r.encontrado, false);
});

test('sem nenhum identificador: encontrado=false sem chamar o apLIS', async () => {
  const client = clientFake({});
  const ferramentas = criarFerramentasProcesso({ aplisClient: client });
  const r = await ferramentas.consultarPaciente({});
  assert.equal(r.encontrado, false);
  assert.equal(client.chamadas.length, 0);
});

test('não expõe o cliente do apLIS nem outros métodos crus', () => {
  const ferramentas = criarFerramentasProcesso({ aplisClient: clientFake({}) });
  assert.deepEqual(Object.keys(ferramentas), ['consultarPaciente']);
});
