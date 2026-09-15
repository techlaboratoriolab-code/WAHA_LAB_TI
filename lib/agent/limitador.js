// Teto diário de chamadas ao modelo, por atendente. Estourar o teto degrada
// para "sem sugestão" — nunca bloqueia o envio de mensagens, que não passa
// por aqui.
function criarLimitadorDiario({ teto, agora = () => new Date() }) {
  const contagens = new Map();

  function chave(atendenteId) {
    return `${agora().toISOString().slice(0, 10)}:${atendenteId}`;
  }

  function contagemAtual(atendenteId) {
    return contagens.get(chave(atendenteId)) || 0;
  }

  function permitir(atendenteId) {
    if (teto <= 0) return false;
    const k = chave(atendenteId);
    const atual = contagens.get(k) || 0;
    if (atual >= teto) return false;
    contagens.set(k, atual + 1);
    return true;
  }

  return { permitir, contagemAtual };
}

module.exports = { criarLimitadorDiario };
