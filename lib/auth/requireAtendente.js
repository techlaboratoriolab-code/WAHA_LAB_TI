const { extrairPermissoes, temAcessoWhatsapp } = require('./permissoes');

function extrairBearer(req) {
  const cabecalho = req.headers && req.headers.authorization;
  if (typeof cabecalho !== 'string') return null;
  const partes = cabecalho.split(' ');
  if (partes.length !== 2 || partes[0] !== 'Bearer' || !partes[1]) return null;
  return partes[1];
}

// verificarToken(token) -> { id, email } | null
// carregarPerfil(userId) -> perfil (linha de user_profiles com custom_roles) | null
function criarRequireAtendente({ verificarToken, carregarPerfil }) {
  return async function requireAtendente(req, res, next) {
    const token = extrairBearer(req);
    if (!token) {
      return res.status(401).json({ error: 'Autenticação necessária.' });
    }

    let usuario;
    try {
      usuario = await verificarToken(token);
    } catch (e) {
      usuario = null;
    }
    if (!usuario || !usuario.id) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    let perfil;
    try {
      perfil = await carregarPerfil(usuario.id);
    } catch (e) {
      perfil = null;
    }
    if (!temAcessoWhatsapp(perfil)) {
      return res.status(403).json({ error: 'Sem permissão para usar o atendimento.' });
    }

    req.atendente = {
      id: usuario.id,
      email: perfil.email || usuario.email,
      name: perfil.name,
      role: perfil.role,
      department: perfil.department,
      permissions: extrairPermissoes(perfil)
    };
    return next();
  };
}

module.exports = { criarRequireAtendente };
