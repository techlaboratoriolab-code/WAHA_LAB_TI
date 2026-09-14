function extrairPermissoes(perfil) {
  const permissoes = perfil && perfil.custom_roles && perfil.custom_roles.permissions;
  return Array.isArray(permissoes) ? permissoes : [];
}

function temAcessoWhatsapp(perfil) {
  if (!perfil) return false;
  const permissoes = extrairPermissoes(perfil);
  const admin = perfil.role === 'admin' || permissoes.includes('*') || permissoes.includes('all');
  return admin || permissoes.includes('canUseWhatsapp');
}

module.exports = { extrairPermissoes, temAcessoWhatsapp };
