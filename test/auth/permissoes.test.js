const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extrairPermissoes, temAcessoWhatsapp } = require('../../lib/auth/permissoes');

test('extrairPermissoes devolve lista vazia quando o perfil não tem custom_roles', () => {
  assert.deepEqual(extrairPermissoes({ role: 'requester' }), []);
  assert.deepEqual(extrairPermissoes({ role: 'requester', custom_roles: null }), []);
  assert.deepEqual(extrairPermissoes({ role: 'requester', custom_roles: { permissions: 'x' } }), []);
  assert.deepEqual(extrairPermissoes(null), []);
});

test('extrairPermissoes devolve as permissões do custom_roles', () => {
  const perfil = { custom_roles: { permissions: ['canUseWhatsapp', 'outra'] } };
  assert.deepEqual(extrairPermissoes(perfil), ['canUseWhatsapp', 'outra']);
});

test('temAcessoWhatsapp: admin por role sempre tem acesso', () => {
  assert.equal(temAcessoWhatsapp({ role: 'admin' }), true);
});

test('temAcessoWhatsapp: curinga * ou all concede acesso', () => {
  assert.equal(temAcessoWhatsapp({ role: 'requester', custom_roles: { permissions: ['*'] } }), true);
  assert.equal(temAcessoWhatsapp({ role: 'requester', custom_roles: { permissions: ['all'] } }), true);
});

test('temAcessoWhatsapp: permissão explícita canUseWhatsapp concede acesso', () => {
  assert.equal(temAcessoWhatsapp({ role: 'requester', custom_roles: { permissions: ['canUseWhatsapp'] } }), true);
});

test('temAcessoWhatsapp: requester sem permissão não tem acesso', () => {
  assert.equal(temAcessoWhatsapp({ role: 'requester' }), false);
  assert.equal(temAcessoWhatsapp({ role: 'requester', custom_roles: { permissions: ['outra'] } }), false);
});

test('temAcessoWhatsapp: perfil ausente não tem acesso', () => {
  assert.equal(temAcessoWhatsapp(null), false);
  assert.equal(temAcessoWhatsapp(undefined), false);
});
