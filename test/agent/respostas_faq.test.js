const { test } = require('node:test');
const assert = require('node:assert/strict');
const { obterRespostaFaq, RESPOSTAS_FAQ } = require('../../lib/agent/respostas_faq');
const { QUICK_RESPONSES } = require('../../public/quick_responses.js');

test('orientacao_preparo devolve o texto literal da Resposta Rápida PREPARO, nunca reparafraseado', () => {
  const preparo = QUICK_RESPONSES.find((r) => r.id === 'PREPARO');
  const resposta = obterRespostaFaq('orientacao_preparo');
  assert.equal(resposta.texto, preparo.text);
  assert.equal(resposta.baseadoEm, 'PREPARO');
});

test('intenção sem resposta FAQ mapeada devolve null, não inventa nada', () => {
  assert.equal(obterRespostaFaq('previsao_entrega'), null);
  assert.equal(obterRespostaFaq('outro'), null);
  assert.equal(obterRespostaFaq('intencao_que_nao_existe'), null);
});

test('RESPOSTAS_FAQ só cobre intenções realmente sem dependência de dado do paciente', () => {
  assert.deepEqual(Object.keys(RESPOSTAS_FAQ), ['orientacao_preparo']);
});
