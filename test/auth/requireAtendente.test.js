const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarRequireAtendente } = require('../../lib/auth/requireAtendente');

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

function fakeReq({ authorization, body } = {}) {
  return {
    headers: authorization !== undefined ? { authorization } : {},
    body: body || {}
  };
}

const usuarioValido = { id: 'user-123', email: 'ana@lab.com' };
const perfilAutorizado = {
  id: 'user-123', email: 'ana@lab.com', name: 'Ana Souza', role: 'requester',
  department: 'Atendimento', custom_roles: { permissions: ['canUseWhatsapp'] }
};
const perfilSemPermissao = { ...perfilAutorizado, custom_roles: { permissions: [] } };

function montar({ verificarToken, carregarPerfil } = {}) {
  const chamadas = { verificar: [], carregar: [] };
  const mw = criarRequireAtendente({
    verificarToken: async (t) => { chamadas.verificar.push(t); return verificarToken ? verificarToken(t) : null; },
    carregarPerfil: async (id) => { chamadas.carregar.push(id); return carregarPerfil ? carregarPerfil(id) : null; }
  });
  return { mw, chamadas };
}

async function executar(mw, req) {
  const res = fakeRes();
  let nextChamado = false;
  await mw(req, res, () => { nextChamado = true; });
  return { res, nextChamado };
}

test('sem cabeçalho Authorization responde 401 e não consulta nada', async () => {
  const { mw, chamadas } = montar();
  const { res, nextChamado } = await executar(mw, fakeReq());
  assert.equal(res.statusCode, 401);
  assert.equal(nextChamado, false);
  assert.equal(chamadas.verificar.length, 0);
  assert.equal(chamadas.carregar.length, 0);
});

test('cabeçalho sem o esquema Bearer responde 401', async () => {
  const { mw, chamadas } = montar();
  const { res, nextChamado } = await executar(mw, fakeReq({ authorization: 'Basic abc' }));
  assert.equal(res.statusCode, 401);
  assert.equal(nextChamado, false);
  assert.equal(chamadas.verificar.length, 0);
});

test('token inválido responde 401 e não carrega perfil', async () => {
  const { mw, chamadas } = montar({ verificarToken: () => null });
  const { res, nextChamado } = await executar(mw, fakeReq({ authorization: 'Bearer ruim' }));
  assert.equal(res.statusCode, 401);
  assert.equal(nextChamado, false);
  assert.deepEqual(chamadas.verificar, ['ruim']);
  assert.equal(chamadas.carregar.length, 0);
});

test('falha na verificação do token responde 401 sem vazar o erro', async () => {
  const { mw } = montar({ verificarToken: () => { throw new Error('segredo interno'); } });
  const { res, nextChamado } = await executar(mw, fakeReq({ authorization: 'Bearer x' }));
  assert.equal(res.statusCode, 401);
  assert.equal(nextChamado, false);
  assert.ok(!JSON.stringify(res.body).includes('segredo interno'));
});

test('token válido sem perfil responde 403', async () => {
  const { mw } = montar({ verificarToken: () => usuarioValido, carregarPerfil: () => null });
  const { res, nextChamado } = await executar(mw, fakeReq({ authorization: 'Bearer ok' }));
  assert.equal(res.statusCode, 403);
  assert.equal(nextChamado, false);
});

test('token válido com perfil sem permissão de WhatsApp responde 403', async () => {
  const { mw } = montar({ verificarToken: () => usuarioValido, carregarPerfil: () => perfilSemPermissao });
  const { res, nextChamado } = await executar(mw, fakeReq({ authorization: 'Bearer ok' }));
  assert.equal(res.statusCode, 403);
  assert.equal(nextChamado, false);
});

test('token válido e perfil autorizado chama next e anexa o atendente', async () => {
  const { mw, chamadas } = montar({ verificarToken: () => usuarioValido, carregarPerfil: () => perfilAutorizado });
  const req = fakeReq({ authorization: 'Bearer ok' });
  const { res, nextChamado } = await executar(mw, req);
  assert.equal(nextChamado, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(chamadas.carregar, ['user-123']);
  assert.deepEqual(req.atendente, {
    id: 'user-123',
    email: 'ana@lab.com',
    name: 'Ana Souza',
    role: 'requester',
    department: 'Atendimento',
    permissions: ['canUseWhatsapp']
  });
});

test('identidade vem do token, ignorando staffId divergente no corpo', async () => {
  const { mw } = montar({ verificarToken: () => usuarioValido, carregarPerfil: () => perfilAutorizado });
  const req = fakeReq({ authorization: 'Bearer ok', body: { staffId: 'outro-usuario' } });
  await executar(mw, req);
  assert.equal(req.atendente.id, 'user-123');
});

test('perfil admin por role passa mesmo sem custom_roles', async () => {
  const perfilAdmin = { id: 'user-123', email: 'a@l.com', name: 'Adm', role: 'admin', department: 'TI' };
  const { mw } = montar({ verificarToken: () => usuarioValido, carregarPerfil: () => perfilAdmin });
  const req = fakeReq({ authorization: 'Bearer ok' });
  const { nextChamado } = await executar(mw, req);
  assert.equal(nextChamado, true);
  assert.deepEqual(req.atendente.permissions, []);
});
