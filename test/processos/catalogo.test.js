const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CATALOGO_PROCESSOS } = require('../../lib/processos/catalogo');

const INTENCOES_MVP = ['previsao_entrega', 'laudo_disponivel', 'status_exame'];

test('o catálogo cobre exatamente as três intenções do MVP', () => {
  assert.deepEqual(CATALOGO_PROCESSOS.map((p) => p.intencao).sort(), [...INTENCOES_MVP].sort());
});

test('nenhum dos três processos iniciais usa a escotilha de função', () => {
  for (const p of CATALOGO_PROCESSOS) {
    assert.equal(typeof p.buscar, 'object', `${p.id}.buscar deveria ser declarativo`);
    assert.equal(typeof p.renderizar, 'object', `${p.id}.renderizar deveria ser declarativo`);
  }
});

test('cada processo aponta para um templateId que existe em AGENT_TEMPLATES', () => {
  const templates = require('../../public/agent_templates.js');
  for (const p of CATALOGO_PROCESSOS) {
    assert.ok(templates[p.renderizar.templateId], `template "${p.renderizar.templateId}" não existe`);
  }
});
