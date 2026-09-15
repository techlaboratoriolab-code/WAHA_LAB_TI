const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calcularSugestoes } = require('../../lib/processos/sugestoes');

const SITUACAO_COMPLETA = {
  codRequisicao: '0210029277004', paciente: 'MARIA DA SILVA', exame: 'Citologia',
  dtaPrevista: '20/09/2026', statusCliente: 'Em análise no laboratório'
};

test('com todos os dados presentes, sugere as três respostas', async () => {
  const sugestoes = await calcularSugestoes(SITUACAO_COMPLETA);
  assert.deepEqual(sugestoes.map((s) => s.processoId).sort(), ['laudo_disponivel', 'previsao_entrega', 'status_exame']);
  const previsao = sugestoes.find((s) => s.processoId === 'previsao_entrega');
  assert.ok(previsao.texto.includes('20/09/2026'));
  assert.ok(previsao.texto.includes('Citologia'));
});

test('sem dtaPrevista, previsao_entrega não é sugerida mas as outras duas continuam', async () => {
  const sugestoes = await calcularSugestoes({ ...SITUACAO_COMPLETA, dtaPrevista: null });
  assert.deepEqual(sugestoes.map((s) => s.processoId).sort(), ['laudo_disponivel', 'status_exame']);
});

test('sem statusCliente, status_exame e laudo_disponivel não são sugeridos', async () => {
  const sugestoes = await calcularSugestoes({ ...SITUACAO_COMPLETA, statusCliente: null });
  assert.deepEqual(sugestoes.map((s) => s.processoId), ['previsao_entrega']);
});

test('cada sugestão traz a intenção que a originou', async () => {
  const sugestoes = await calcularSugestoes(SITUACAO_COMPLETA);
  const status = sugestoes.find((s) => s.processoId === 'status_exame');
  assert.equal(status.intencao, 'status_exame');
});
