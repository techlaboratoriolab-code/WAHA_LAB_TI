const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizarRequisicao, extrairStatusCliente } = require('../../lib/aplis/normalizar');

const itemListar = {
  IdRequisicao: 1608192, CodRequisicao: '0210029277004', DtaSolicitacao: '31/10/2024 09:12:00',
  DtaFinalizacao: '', DtaPrevista: '07/11/2024', CodPaciente: 555, NomPaciente: 'MARIA DA SILVA',
  CPF: '12345678901', NomExame: 'Citologia', DesEvento: 'Em análise', StatusExame: 0, CodPrioridade: 0
};

test('normalizarRequisicao mapeia os campos do requisicaoListar para o formato interno', () => {
  assert.deepEqual(normalizarRequisicao(itemListar), {
    codRequisicao: '0210029277004',
    codPaciente: 555,
    paciente: 'MARIA DA SILVA',
    cpf: '12345678901',
    exame: 'Citologia',
    statusExame: 0,
    situacao: 'em_andamento',
    status: 'Em análise',
    dtaSolicitacao: '31/10/2024 09:12:00',
    dtaPrevista: '07/11/2024',
    dtaFinalizacao: null,
    prioridade: 0
  });
});

test('normalizarRequisicao traduz StatusExame 1 e 2 para concluido e cancelado', () => {
  assert.equal(normalizarRequisicao({ ...itemListar, StatusExame: 1 }).situacao, 'concluido');
  assert.equal(normalizarRequisicao({ ...itemListar, StatusExame: 2 }).situacao, 'cancelado');
  assert.equal(normalizarRequisicao({ ...itemListar, StatusExame: 9 }).situacao, 'desconhecido');
});

test('normalizarRequisicao converte campos vazios em null', () => {
  const r = normalizarRequisicao({ ...itemListar, DtaPrevista: '', CPF: '', NomExame: undefined });
  assert.equal(r.dtaPrevista, null);
  assert.equal(r.cpf, null);
  assert.equal(r.exame, null);
});

// O apLIS devolve datas como DD/MM/AAAA HH:MM (diferente do formato de entrada documentado).
test('extrairStatusCliente prefere descricaoCliente da entrada mais recente do histórico', () => {
  const dat = {
    codRequisicao: '0210029277004',
    historico: [
      { data: '31/10/2024 09:12', descricao: 'Admitido', descricaoCliente: 'Material recebido' },
      { data: '02/11/2024 15:00', descricao: 'Em macroscopia', descricaoCliente: 'Em análise no laboratório' },
      { data: '01/11/2024 08:00', descricao: 'Triagem', descricaoCliente: 'Em preparação' }
    ]
  };
  assert.equal(extrairStatusCliente(dat), 'Em análise no laboratório');
});

test('extrairStatusCliente ordena por data real, não por texto: 28/08 vem antes de 08/09', () => {
  const dat = {
    historico: [
      { data: '08/09/2026 18:19', descricao: 'Novo', descricaoCliente: 'Mais recente' },
      { data: '28/08/2026 17:07', descricao: 'Antigo', descricaoCliente: 'Mais antigo' }
    ]
  };
  assert.equal(extrairStatusCliente(dat), 'Mais recente');
});

test('extrairStatusCliente usa a ordem devolvida quando a data não é parseável', () => {
  const dat = {
    historico: [
      { data: 'x', descricao: 'Primeiro', descricaoCliente: 'Primeiro' },
      { data: 'y', descricao: 'Último', descricaoCliente: 'Último' }
    ]
  };
  assert.equal(extrairStatusCliente(dat), 'Último');
});

test('extrairStatusCliente cai para descricao interna quando descricaoCliente está vazia', () => {
  const dat = { historico: [{ data: '02/11/2024 15:00', descricao: 'Em macroscopia', descricaoCliente: '' }] };
  assert.equal(extrairStatusCliente(dat), 'Em macroscopia');
});

test('extrairStatusCliente devolve null sem histórico', () => {
  assert.equal(extrairStatusCliente({ historico: [] }), null);
  assert.equal(extrairStatusCliente({}), null);
  assert.equal(extrairStatusCliente(null), null);
});
