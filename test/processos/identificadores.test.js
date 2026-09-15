const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extrairIdentificadoresDeTexto } = require('../../lib/processos/identificadores');
const { LEN_CODIGO_REQUISICAO, LEN_CPF } = require('../../lib/aplis/formatos');

test('extrai código de requisição de 13 dígitos do texto corrido', () => {
  const r = extrairIdentificadoresDeTexto('meu protocolo é 0085088021000, chegou?');
  assert.equal(r.codRequisicao, '0085088021000');
});

test('o comprimento reconhecido é o mesmo LEN_CODIGO_REQUISICAO/LEN_CPF da busca manual', () => {
  assert.equal(LEN_CODIGO_REQUISICAO, '0085088021000'.length);
  assert.equal(extrairIdentificadoresDeTexto('0'.repeat(LEN_CODIGO_REQUISICAO + 1)).codRequisicao, null);
  assert.equal(LEN_CPF, '12345678901'.length);
});

test('extrai código mesmo colado ao nome, no padrão observado nas conversas reais', () => {
  const r = extrairIdentificadoresDeTexto('0085088021000 - fulano de tal');
  assert.equal(r.codRequisicao, '0085088021000');
});

test('extrai CPF com pontuação', () => {
  const r = extrairIdentificadoresDeTexto('meu cpf é 123.456.789-01');
  assert.equal(r.cpf, '12345678901');
});

test('extrai CPF sem pontuação', () => {
  const r = extrairIdentificadoresDeTexto('cpf 12345678901 obrigado');
  assert.equal(r.cpf, '12345678901');
});

test('extrai credencial de portal no formato P + 5 ou 6 dígitos', () => {
  assert.equal(extrairIdentificadoresDeTexto('usuário: P82419 senha: 3772').credencialPortal, 'P82419');
  assert.equal(extrairIdentificadoresDeTexto('login P100486').credencialPortal, 'P100486');
});

test('não confunde CPF com código de requisição de 13 dígitos', () => {
  const r = extrairIdentificadoresDeTexto('0085088021000 e cpf 12345678901');
  assert.equal(r.codRequisicao, '0085088021000');
  assert.equal(r.cpf, '12345678901');
});

test('número de telefone (mais de 11 dígitos) não é confundido com CPF', () => {
  const r = extrairIdentificadoresDeTexto('me chama no 556198765432');
  assert.equal(r.cpf, null);
});

test('texto sem nenhum identificador devolve tudo null', () => {
  assert.deepEqual(extrairIdentificadoresDeTexto('bom dia, meu exame já ficou pronto?'), {
    codRequisicao: null, cpf: null, credencialPortal: null
  });
});

test('varre múltiplas mensagens e usa a primeira ocorrência de cada tipo', () => {
  const r = extrairIdentificadoresDeTexto(['oi, bom dia', 'meu cpf é 111.222.333-44', 'e o protocolo 0085088021000']);
  assert.equal(r.cpf, '11122233344');
  assert.equal(r.codRequisicao, '0085088021000');
});

test('entrada vazia ou nula não lança erro', () => {
  assert.deepEqual(extrairIdentificadoresDeTexto(''), { codRequisicao: null, cpf: null, credencialPortal: null });
  assert.deepEqual(extrairIdentificadoresDeTexto(null), { codRequisicao: null, cpf: null, credencialPortal: null });
  assert.deepEqual(extrairIdentificadoresDeTexto([]), { codRequisicao: null, cpf: null, credencialPortal: null });
});
