// Chamadas às rotas do agente (/api/agent/*, /api/aplis/*) com o token da sessão.
// O servidor decide quem é o atendente a partir do token; nada de identidade no corpo.
(function () {
  function tokenDaSessao() {
    try {
      return localStorage.getItem('flowlab_token') || null;
    } catch (e) {
      return null;
    }
  }

  async function agentFetch(url, options) {
    const opts = Object.assign({}, options || {});
    const headers = new Headers(opts.headers || {});
    const token = tokenDaSessao();
    if (token) headers.set('Authorization', 'Bearer ' + token);
    opts.headers = headers;
    const res = await fetch(url, opts);
    // 401 aqui significa token ausente ou expirado; só dispara se havia um token,
    // para não deslogar um usuário que nem chegou a autenticar.
    if (res.status === 401 && token && typeof window.flowlabSessaoExpirada === 'function') {
      window.flowlabSessaoExpirada();
    }
    return res;
  }

  window.agentFetch = agentFetch;
})();
