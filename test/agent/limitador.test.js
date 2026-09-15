const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarLimitadorDiario } = require('../../lib/agent/limitador');

test('permite chamadas até o teto e bloqueia a partir dele', () => {
  const lim = criarLimitadorDiario({ teto: 3 });
  assert.equal(lim.permitir('atendente-1'), true);
  assert.equal(lim.permitir('atendente-1'), true);
  assert.equal(lim.permitir('atendente-1'), true);
  assert.equal(lim.permitir('atendente-1'), false);
  assert.equal(lim.permitir('atendente-1'), false);
});

test('cada atendente tem seu próprio contador, independente dos outros', () => {
  const lim = criarLimitadorDiario({ teto: 1 });
  assert.equal(lim.permitir('a'), true);
  assert.equal(lim.permitir('a'), false);
  assert.equal(lim.permitir('b'), true);
});

test('teto 0 ou negativo bloqueia tudo', () => {
  const lim = criarLimitadorDiario({ teto: 0 });
  assert.equal(lim.permitir('a'), false);
});

test('contagemAtual reflete o uso sem consumir uma chamada', () => {
  const lim = criarLimitadorDiario({ teto: 5 });
  lim.permitir('a');
  lim.permitir('a');
  assert.equal(lim.contagemAtual('a'), 2);
  assert.equal(lim.contagemAtual('a'), 2);
});

test('a contagem reinicia num novo dia', () => {
  let diaAtual = new Date('2026-09-15T10:00:00Z');
  const lim = criarLimitadorDiario({ teto: 1, agora: () => diaAtual });
  assert.equal(lim.permitir('a'), true);
  assert.equal(lim.permitir('a'), false);
  diaAtual = new Date('2026-09-16T10:00:00Z');
  assert.equal(lim.permitir('a'), true);
});
