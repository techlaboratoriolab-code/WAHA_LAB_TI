const { test } = require('node:test');
const assert = require('node:assert/strict');
const { interpretarFontePagadora } = require('../../lib/db/convenio');

test('fonte pagadora chamada "Cortesia" (qualquer caixa/acento) vira a frase de cortesia', () => {
  assert.equal(interpretarFontePagadora({ fontePagadoraNome: 'Cortesia' }), 'cortesia, sem cobrança');
  assert.equal(interpretarFontePagadora({ fontePagadoraNome: 'CORTESIA' }), 'cortesia, sem cobrança');
  assert.equal(interpretarFontePagadora({ convenioNome: 'cortesia' }), 'cortesia, sem cobrança');
});

test('fonte pagadora "Particular" vira a frase de atendimento particular', () => {
  assert.equal(interpretarFontePagadora({ fontePagadoraNome: 'PARTICULAR' }), 'atendimento particular');
});

test('qualquer outro nome vira "convênio <nome>", preservando a grafia original', () => {
  assert.equal(interpretarFontePagadora({ fontePagadoraNome: 'BRADESCO SAUDE  - 005711' }), 'convênio BRADESCO SAUDE  - 005711');
});

test('convenioNome é usado quando fontePagadoraNome está ausente', () => {
  assert.equal(interpretarFontePagadora({ convenioNome: 'CASSI' }), 'convênio CASSI');
});

test('sem nenhum nome (nulo, indefinido ou registro ausente), devolve null — nunca inventa', () => {
  assert.equal(interpretarFontePagadora(null), null);
  assert.equal(interpretarFontePagadora(undefined), null);
  assert.equal(interpretarFontePagadora({}), null);
  assert.equal(interpretarFontePagadora({ fontePagadoraNome: null, convenioNome: '' }), null);
});
