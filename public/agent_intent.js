// Detecção de intenção (#5), ligada ao painel do agente (#4) — a integração
// mínima para testar as duas juntas antes da fiação completa da #6.
//
// Roda sempre que loadMessages() re-renderiza (abertura da conversa ou
// mensagem nova com o chat aberto), nunca a cada mensagem isoladamente:
// só quando o conjunto de mensagens realmente muda.
(function () {
  // chatId -> { chave, resultado } — evita reanalisar quando nada mudou, e
  // reexibe a mesma detecção ao reabrir a conversa sem gastar chamada nova.
  const cachePorChat = new Map();

  function textoDaMensagem(m) {
    if (typeof m.body === 'string' && m.body) return m.body;
    if (typeof m.caption === 'string' && m.caption) return m.caption;
    return '';
  }

  // Ignora ack/leitura: só o conteúdo e quem mandou a última mensagem importam
  // para decidir se é preciso analisar de novo.
  function chaveDedupe(mensagens) {
    const ultima = mensagens[mensagens.length - 1];
    if (!ultima) return '';
    return `${ultima.fromMe ? '1' : '0'}|${ultima.timestamp || ''}|${textoDaMensagem(ultima).slice(0, 60)}`;
  }

  async function analisar(chatId, mensagens) {
    if (!chatId || chatId.endsWith('@g.us')) return;
    if (!window.agentPanel || typeof window.agentPanel.mostrarDeteccao !== 'function') return;
    if (typeof window.agentFetch !== 'function') return;

    const ultimas30 = (mensagens || [])
      .slice(-30)
      .map((m) => ({ fromMe: m.fromMe === true, body: textoDaMensagem(m) }));

    // Sem mensagem nova do paciente não há nada novo a classificar — evita
    // reanalisar a cada resposta que o próprio atendente manda.
    const ultima = ultimas30[ultimas30.length - 1];
    if (!ultima || ultima.fromMe) return;

    const chave = chaveDedupe(ultimas30);
    if (!chave) return;

    const cache = cachePorChat.get(chatId);
    if (cache && cache.chave === chave) {
      if (cache.resultado) window.agentPanel.mostrarDeteccao(cache.resultado);
      return;
    }

    try {
      const res = await window.agentFetch('/api/agent/analisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagens: ultimas30 })
      });
      const data = await res.json().catch(() => ({}));
      const resultado = res.ok && data.intencao
        ? { intencao: data.intencao, confianca: data.confianca, identificadores: data.identificadores || {} }
        : null;

      cachePorChat.set(chatId, { chave, resultado });
      if (resultado) window.agentPanel.mostrarDeteccao(resultado);
    } catch (e) {
      // Falha de rede na detecção não pode incomodar o atendente: o painel
      // simplesmente fica quieto, como se nada tivesse sido reconhecido.
    }
  }

  window.agentIntent = { analisar };
})();
