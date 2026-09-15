const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montarFatosParaModelo, sanitizarRedacao } = require('../../lib/agent/redator');

test('montarFatosParaModelo mantém só exame, dtaPrevista e statusCliente', () => {
  const situacao = {
    codRequisicao: '0210029277004', codPaciente: 555, paciente: 'MARIA DA SILVA', cpf: '12345678901',
    exame: 'Citologia', dtaPrevista: '20/09/2026', statusCliente: 'Em análise'
  };
  assert.deepEqual(montarFatosParaModelo(situacao), { exame: 'Citologia', dtaPrevista: '20/09/2026', statusCliente: 'Em análise' });
});

test('montarFatosParaModelo nunca inclui paciente, cpf, codPaciente ou codRequisicao', () => {
  const fatos = montarFatosParaModelo({ paciente: 'X', cpf: '123', codPaciente: 1, codRequisicao: '2', exame: 'Y' });
  assert.deepEqual(Object.keys(fatos), ['exame']);
});

test('montarFatosParaModelo omite campos nulos/vazios em vez de mandar null', () => {
  const fatos = montarFatosParaModelo({ exame: 'Citologia', dtaPrevista: null, statusCliente: '' });
  assert.deepEqual(fatos, { exame: 'Citologia' });
});

test('sanitizarRedacao aceita texto não vazio', () => {
  assert.deepEqual(sanitizarRedacao({ texto: '  Olá, seu exame está pronto.  ' }), { texto: 'Olá, seu exame está pronto.' });
});

test('sanitizarRedacao rejeita texto vazio, só espaço, ausente ou entrada inválida', () => {
  assert.equal(sanitizarRedacao({ texto: '' }), null);
  assert.equal(sanitizarRedacao({ texto: '   ' }), null);
  assert.equal(sanitizarRedacao({}), null);
  assert.equal(sanitizarRedacao(null), null);
  assert.equal(sanitizarRedacao('texto solto'), null);
});
