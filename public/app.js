/**
 * WHATSAPP WEB WAHA - LÓGICA DO CLIENTE (FRONTEND COM PAGINAÇÃO ULTRA-RÁPIDA)
 */

document.addEventListener('DOMContentLoaded', () => {

  // ESTADO DA APLICAÇÃO
  let allChats = [];
  let currentOffset = 0;
  const pageSize = 50;
  let isLoadingMore = false;
  let hasMoreChats = true;

  const MAX_CONTACTS = 100;
  const initialChunkSize = 50;
  let isStreamingChunks = false;
  let currentStreamId = 0;

  let activeChat = null;
  let selectedFile = null;
  const messagesCache = new Map(); // Cache em memória de mensagens por chatId

  // ELEMENTOS DO DOM
  const sessionStatusEl = document.getElementById('session-status');
  const sessionStatusTextEl = document.getElementById('session-status-text');
  const chatsListEl = document.getElementById('chats-list');
  const chatsCountTextEl = document.getElementById('chats-count-text');
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const activeFilterTag = document.getElementById('active-filter-tag');

  const emptyStateEl = document.getElementById('empty-state');
  const activeChatContainerEl = document.getElementById('active-chat-container');
  const activeAvatarEl = document.getElementById('active-avatar');
  const activeChatNameEl = document.getElementById('active-chat-name');
  const activeChatIdEl = document.getElementById('active-chat-id');
  const messagesContainerEl = document.getElementById('messages-container');

  const messageTextInput = document.getElementById('message-text-input');
  const sendMsgBtn = document.getElementById('send-msg-btn');

  const attachBtn = document.getElementById('attach-btn');
  const fileInput = document.getElementById('file-input');
  const filePreviewPanel = document.getElementById('file-preview-panel');
  const previewFilenameEl = document.getElementById('preview-filename');
  const previewFilesizeEl = document.getElementById('preview-filesize');
  const removeFileBtn = document.getElementById('remove-file-btn');

  const newChatBtn = document.getElementById('new-chat-btn');
  const restartSessionBtn = document.getElementById('restart-session-btn');
  const newChatModal = document.getElementById('new-chat-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelModalBtn = document.getElementById('cancel-modal-btn');
  const startChatBtn = document.getElementById('start-chat-btn');
  const newNumberInput = document.getElementById('new-number-input');

  const refreshChatsBtn = document.getElementById('refresh-chats-btn');
  const refreshMessagesBtn = document.getElementById('refresh-messages-btn');
  const copyNumberBtn = document.getElementById('copy-number-btn');
  const toggleThemeBtn = document.getElementById('toggle-theme-btn');

  // ---------------------------------------------------------------------------
  // INICIALIZAÇÃO
  // ---------------------------------------------------------------------------
  initApp();

  function initApp() {
    checkSessionStatus();
    loadInitialChats();
    setupEventListeners();
    setupRealtimeEvents();
    startSmartPollingSync();
    refreshLucideIcons();
  }

  function refreshLucideIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try { window.lucide.createIcons(); } catch(e) {}
    }
  }

  // ---------------------------------------------------------------------------
  // HELPERS DE MENSAGENS E PREVIEW RECENTE
  // ---------------------------------------------------------------------------
  function getLatestMessageFromList(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return null;
    return messages.reduce((latest, current) => {
      if (!latest) return current;
      const latestTs = Number(latest.timestamp || 0);
      const currentTs = Number(current.timestamp || 0);
      return currentTs >= latestTs ? current : latest;
    }, null);
  }

  function formatPreviewFromMessage(msg) {
    if (!msg) return '';
    let preview = msg.body || '';
    if (msg.hasMedia || msg.type === 'document' || msg.type === 'image' || msg.type === 'ptt' || msg.type === 'audio' || msg.type === 'video') {
      if (msg.type === 'document') preview = '📄 Documento PDF';
      else if (msg.type === 'image') preview = '📷 Foto';
      else if (msg.type === 'ptt' || msg.type === 'audio') preview = '🎵 Áudio';
      else if (msg.type === 'video') preview = '🎥 Vídeo';
      else preview = '📎 Mídia';
      if (msg.caption) preview += `: ${msg.caption}`;
    }
    return preview;
  }

  // ---------------------------------------------------------------------------
  // POLLING INTELIGENTE (ATUALIZAÇÃO INCREMENTAL SEM PERDER PROGRESSO)
  // ---------------------------------------------------------------------------
  function startSmartPollingSync() {
    // 1. Verificar mensagens novas da conversa aberta a cada 2.5s
    setInterval(async () => {
      if (!activeChat || !activeChat.id) return;
      try {
        const res = await fetch(`/api/chats/${encodeURIComponent(activeChat.id)}/messages?limit=25`);
        if (!res.ok) return;

        const newMessages = await res.json();
        if (!Array.isArray(newMessages) || newMessages.length === 0) return;

        const cached = messagesCache.get(activeChat.id) || [];
        const lastCachedId = cached.length > 0 ? cached[cached.length - 1].id : null;
        const lastNewId = newMessages.length > 0 ? newMessages[0].id : null;

        if (newMessages.length !== cached.length || lastCachedId !== lastNewId) {
          messagesCache.set(activeChat.id, newMessages);

          const latestMsg = getLatestMessageFromList(newMessages);
          if (latestMsg) {
            activeChat.lastMessagePreview = formatPreviewFromMessage(latestMsg);
            activeChat.lastMessageFromMe = latestMsg.fromMe === true;
            if (latestMsg.timestamp) {
              activeChat.lastActivity = Number(latestMsg.timestamp);
              activeChat.conversationTimestamp = Number(latestMsg.timestamp);
            }
          }

          renderMessages(newMessages);
          sortChatsDescending(allChats);
          if (searchInput.value.trim() === '') {
            renderChatsList(allChats);
          }
        }
      } catch (e) {
        // Ignora falhas isoladas de polling
      }
    }, 2500);

    // 2. Verificar se chegaram mensagens em outros contatos recentes a cada 4s
    setInterval(async () => {
      try {
        const res = await fetch(`/api/chats?limit=15&offset=0`);
        if (!res.ok) return;

        const topChats = await res.json();
        if (!Array.isArray(topChats) || topChats.length === 0) return;

        let hasChanged = false;

        topChats.forEach(freshChat => {
          let existing = allChats.find(c => c.id === freshChat.id);
          if (!existing) {
            if (freshChat.lastMessageFromMe === false) {
              freshChat.unreadCount = 1;
              freshChat.unread = true;
            }
            allChats.push(freshChat);
            hasChanged = true;
          } else {
            const oldTs = getChatTimestampInSeconds(existing);
            const newTs = getChatTimestampInSeconds(freshChat);
            if (newTs > oldTs || existing.lastMessagePreview !== freshChat.lastMessagePreview) {
              existing.conversationTimestamp = freshChat.conversationTimestamp || existing.conversationTimestamp;
              existing.lastActivity = freshChat.lastActivity || freshChat.conversationTimestamp || existing.lastActivity;
              if (freshChat.lastMessagePreview) existing.lastMessagePreview = freshChat.lastMessagePreview;
              if (freshChat.lastMessageFromMe !== undefined) existing.lastMessageFromMe = freshChat.lastMessageFromMe;

              if (freshChat.lastMessageFromMe === false && (!activeChat || activeChat.id !== existing.id)) {
                existing.unreadCount = (existing.unreadCount || 0) + 1;
                existing.unread = true;
              }

              hasChanged = true;
            }
          }
        });

        if (hasChanged) {
          sortChatsDescending(allChats);
          if (searchInput.value.trim() === '') {
            renderChatsList(allChats);
          }
        }
      } catch (e) {
        // Ignora erro de rede temporário
      }
    }, 4000);
  }

  // ---------------------------------------------------------------------------
  // TEMPO REAL (EVENTSOURCE / SSE DE MENSAGENS EM TEMPO REAL)
  // ---------------------------------------------------------------------------
  function setupRealtimeEvents() {
    try {
      const eventSource = new EventSource('/api/events');

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === 'message' && payload.data) {
            handleIncomingRealtimeMessage(payload.data);
          }
        } catch (e) {
          console.error('Erro ao processar mensagem SSE:', e);
        }
      };

      eventSource.onerror = () => {
        // EventSource tenta reconectar automaticamente
      };
    } catch (err) {
      console.warn('Erro ao configurar conexao SSE em tempo real:', err);
    }
  }

  function handleIncomingRealtimeMessage(data) {
    const { chatId, message, preview, fromMe, timestamp } = data;
    if (!chatId) return;

    // 1. Encontrar ou registrar chat na lista local
    let targetChat = allChats.find(c => c.id === chatId);
    if (!targetChat) {
      targetChat = { id: chatId, name: '' };
      allChats.push(targetChat);
    }

    // 2. Atualizar preview, daMe e atividade
    if (preview) targetChat.lastMessagePreview = preview;
    targetChat.lastMessageFromMe = fromMe;
    targetChat.lastActivity = timestamp || Math.floor(Date.now() / 1000);
    targetChat.conversationTimestamp = targetChat.lastActivity;

    // Sinalizar como não lida se for mensagem recebida de terceiros e o chat não estiver aberto
    if (!fromMe && (!activeChat || activeChat.id !== chatId)) {
      targetChat.unreadCount = (targetChat.unreadCount || 0) + 1;
      targetChat.unread = true;
    }

    // 3. Atualizar cache de mensagens se houver dados
    let cached = messagesCache.get(chatId) || [];
    const newMsgObj = {
      id: (message && message.id) || `rt_${Date.now()}`,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      fromMe: fromMe,
      body: (message && message.body) || preview || '',
      hasMedia: (message && message.hasMedia) || false,
      type: (message && message.type) || 'chat'
    };

    const exists = cached.some(m => m.id === newMsgObj.id || (m.body === newMsgObj.body && m.fromMe === newMsgObj.fromMe && Math.abs((m.timestamp || 0) - newMsgObj.timestamp) < 3));
    if (!exists) {
      cached.push(newMsgObj);
      messagesCache.set(chatId, cached);
    }

    // 4. Re-ordenar conversas (o chat vai direto para o topo #1)
    sortChatsDescending(allChats);
    if (searchInput.value.trim() === '') {
      renderChatsList(allChats);
    }

    // 5. SE o chat aberto for o mesmo da mensagem, renderiza as mensagens NA HORA!
    if (activeChat && activeChat.id === chatId) {
      renderMessages(messagesCache.get(chatId) || cached);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. STATUS DA SESSÃO WAHA
  // ---------------------------------------------------------------------------
  async function checkSessionStatus() {
    try {
      const res = await fetch('/api/session-status');
      const data = await res.json();

      if (data.session) {
        const status = data.session.status || 'UNKNOWN';
        if (status === 'WORKING') {
          sessionStatusEl.classList.add('connected');
          sessionStatusTextEl.textContent = 'Conectado (WORKING)';
        } else {
          sessionStatusEl.classList.remove('connected');
          sessionStatusTextEl.textContent = `Status: ${status}`;
        }
      }
    } catch (err) {
      sessionStatusEl.classList.remove('connected');
      sessionStatusTextEl.textContent = 'Desconectado';
    }
  }

  // ---------------------------------------------------------------------------
  // 2. REINICIAR CONEXÃO/SESSÃO SE TRAVAR
  // ---------------------------------------------------------------------------
  async function restartSession() {
    try {
      showToast('Reiniciando conexão com o WhatsApp...', 'info');
      sessionStatusTextEl.textContent = 'Reiniciando...';
      sessionStatusEl.classList.remove('connected');

      const res = await fetch('/api/restart-session', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        showToast('Sessão reiniciada com sucesso!');
        setTimeout(checkSessionStatus, 3000);
      } else {
        showToast('Erro ao reiniciar sessão.', 'error');
        checkSessionStatus();
      }
    } catch (err) {
      showToast('Erro ao comunicar com o servidor: ' + err.message, 'error');
      checkSessionStatus();
    }
  }

  // ---------------------------------------------------------------------------
  // HELPERS DE ORDENAÇÃO POR RECENTE
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // HELPERS DE ORDENAÇÃO E RETENÇÃO DO SELECIONADO NO TOPO
  // ---------------------------------------------------------------------------
  function getChatTimestampInSeconds(chat) {
    let ts = Number(chat.conversationTimestamp || chat.timestamp || 0);
    if (chat.lastMessage && chat.lastMessage.timestamp) {
      ts = Math.max(ts, Number(chat.lastMessage.timestamp));
    }
    if (chat.lastActivity) {
      ts = Math.max(ts, Number(chat.lastActivity));
    }
    if (ts > 1e11) {
      ts = Math.floor(ts / 1000);
    }
    return ts;
  }

  function sortChatsDescending(chats) {
    return chats.sort((a, b) => {
      if (activeChat && a.id === activeChat.id) return -1;
      if (activeChat && b.id === activeChat.id) return 1;

      return getChatTimestampInSeconds(b) - getChatTimestampInSeconds(a);
    });
  }

  // ---------------------------------------------------------------------------
  // PRÉ-CARREGAR MENSAGENS DOS 20 PRIMEIRA CONTATOS EM SEGUNDO PLANO
  // ---------------------------------------------------------------------------
  async function preloadTopContactsMessages(topChats) {
    if (!topChats || topChats.length === 0) return;

    for (const chat of topChats) {
      if (!chat || !chat.id) continue;
      if (messagesCache.has(chat.id)) continue;

      try {
        const res = await fetch(`/api/chats/${encodeURIComponent(chat.id)}/messages?limit=50`);
        if (res.ok) {
          const msgs = await res.json();
          if (Array.isArray(msgs)) {
            messagesCache.set(chat.id, msgs);
            if (msgs.length > 0) {
              const timestamps = msgs.map(m => Number(m.timestamp || 0)).filter(t => t > 0);
              if (timestamps.length > 0) {
                chat.lastActivity = Math.max(...timestamps);
              }
            }
          }
        }
      } catch (e) {
        // Ignora erros individuais de pré-carregamento
      }
      // Pequena pausa entre cada requisição para não congestionar a rede
      await new Promise(r => setTimeout(r, 60));
    }
  }

  // ---------------------------------------------------------------------------
  // 3. CARREGAR CHATS INICIAIS (50 MAIS RECENTES DE INÍCIO, MÁXIMO DE 150)
  // ---------------------------------------------------------------------------
  async function loadInitialChats() {
    try {
      // Parar qualquer streaming anterior
      isStreamingChunks = false;
      currentStreamId++;
      const streamId = currentStreamId;

      allChats = [];
      currentOffset = 0;
      hasMoreChats = true;
      chatsCountTextEl.textContent = 'Carregando 50 conversas mais recentes...';

      // 1. Carregar primeiro chunk com os 50 contatos mais recentes e seus previews
      const res = await fetch(`/api/chats?limit=${initialChunkSize}&offset=0`);
      if (!res.ok) throw new Error('Falha ao carregar chats');

      const chats = await res.json();
      allChats = chats;
      currentOffset = chats.length;

      if (chats.length < initialChunkSize || allChats.length >= MAX_CONTACTS) {
        hasMoreChats = false;
      }

      // Ordenar por data mais recente e renderizar imediatamente
      sortChatsDescending(allChats);
      chatsCountTextEl.textContent = `${allChats.length} conversas recentes (limite 150)`;
      renderChatsList(allChats);

      // 2. Disparar pré-carregamento imediato das mensagens dos 20 primeiros contatos!
      preloadTopContactsMessages(allChats.slice(0, 20));

      // 3. Se houver mais contatos e ainda não atingiu 150, carregar o restante em segundo plano
      if (hasMoreChats && allChats.length < MAX_CONTACTS) {
        startChunkedStreaming(initialChunkSize, streamId);
      }
    } catch (err) {
      showToast('Erro ao carregar lista de chats: ' + err.message, 'error');
      chatsCountTextEl.textContent = 'Erro ao carregar conversas';
      chatsListEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-secondary);">
        Falha ao conectar com WAHA. Verifique o servidor.
      </div>`;
    }
  }

  // ---------------------------------------------------------------------------
  // 4. STREAMING DE CHUNKS EM SEGUNDO PLANO (ATÉ O MÁXIMO DE 150 CONTATOS)
  // ---------------------------------------------------------------------------
  async function startChunkedStreaming(startOffset, streamId) {
    isStreamingChunks = true;
    let offset = startOffset;
    const chunkSize = 50;

    while (hasMoreChats && isStreamingChunks && streamId === currentStreamId && allChats.length < MAX_CONTACTS) {
      // Pequena pausa assíncrona para manter a interface fluida (60 FPS)
      await new Promise(resolve => setTimeout(resolve, 150));
      if (!isStreamingChunks || streamId !== currentStreamId || allChats.length >= MAX_CONTACTS) break;

      try {
        const fetchLimit = Math.min(chunkSize, MAX_CONTACTS - allChats.length);
        if (fetchLimit <= 0) {
          hasMoreChats = false;
          break;
        }

        const res = await fetch(`/api/chats?limit=${fetchLimit}&offset=${offset}`);
        if (!res.ok) break;

        const newChats = await res.json();
        if (newChats.length === 0) {
          hasMoreChats = false;
          break;
        }

        // Filtrar duplicados
        const existingIds = new Set(allChats.map(c => c.id));
        const uniqueNewChats = newChats.filter(c => !existingIds.has(c.id));

        if (uniqueNewChats.length === 0) {
          offset += newChats.length;
          currentOffset = offset;
          if (newChats.length < fetchLimit) {
            hasMoreChats = false;
            break;
          }
          continue;
        }

        const allowedCount = MAX_CONTACTS - allChats.length;
        const chatsToAdd = uniqueNewChats.slice(0, allowedCount);

        allChats.push(...chatsToAdd);
        offset += newChats.length;
        currentOffset = offset;

        if (allChats.length >= MAX_CONTACTS || newChats.length < fetchLimit) {
          hasMoreChats = false;
        }

        // Re-ordenar tudo em ordem decrescente por mensagem/atividade mais recente
        sortChatsDescending(allChats);

        // Se o usuário não estiver pesquisando, atualiza a lista mantendo scroll
        if (searchInput.value.trim() === '') {
          chatsCountTextEl.textContent = `${allChats.length} conversas (máx 150)`;
          renderChatsList(allChats);
        }

      } catch (err) {
        console.error('Erro no streaming de chunks:', err);
        break;
      }
    }

    if (streamId === currentStreamId) {
      isStreamingChunks = false;
      if (searchInput.value.trim() === '') {
        chatsCountTextEl.textContent = `${allChats.length} conversas (máx 150)`;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // CARREGAR MAIS CHATS (MANUALMENTE SE NECESSÁRIO ATÉ O LIMITE DE 150)
  // ---------------------------------------------------------------------------
  async function loadMoreChats() {
    if (isLoadingMore || !hasMoreChats || searchInput.value.trim() !== '' || allChats.length >= MAX_CONTACTS) return;

    isLoadingMore = true;
    const loader = document.createElement('div');
    loader.id = 'load-more-spinner';
    loader.style.cssText = 'text-align: center; padding: 12px; font-size: 0.8rem; color: var(--text-muted);';
    loader.textContent = 'Carregando mais conversas...';
    chatsListEl.appendChild(loader);

    try {
      const fetchLimit = Math.min(pageSize, MAX_CONTACTS - allChats.length);
      const res = await fetch(`/api/chats?limit=${fetchLimit}&offset=${currentOffset}`);
      if (res.ok) {
        const newChats = await res.json();
        if (newChats.length > 0) {
          const existingIds = new Set(allChats.map(c => c.id));
          const uniqueNewChats = newChats.filter(c => !existingIds.has(c.id));

          const allowedCount = MAX_CONTACTS - allChats.length;
          const chatsToAdd = uniqueNewChats.slice(0, allowedCount);

          allChats.push(...chatsToAdd);
          currentOffset += newChats.length;

          if (allChats.length >= MAX_CONTACTS || newChats.length < fetchLimit) {
            hasMoreChats = false;
          }

          sortChatsDescending(allChats);
          chatsCountTextEl.textContent = `${allChats.length} conversas (máx 150)`;
          renderChatsList(allChats);
        } else {
          hasMoreChats = false;
        }
      }
    } catch (err) {
      console.error('Erro ao carregar mais chats:', err);
    } finally {
      isLoadingMore = false;
      const sp = document.getElementById('load-more-spinner');
      if (sp) sp.remove();
    }
  }

  // ---------------------------------------------------------------------------
  // 5. FORMATAR E OBTER NOME DE EXIBIÇÃO INTELIGENTE DO CONTATO
  // ---------------------------------------------------------------------------
  function getContactDisplayInfo(chat) {
    const rawId = chat.id || '';
    const cleanPhone = rawId.replace('@c.us', '').replace('@g.us', '');
    const isGroup = rawId.endsWith('@g.us');

    const hasSavedName = chat.name && chat.name.trim() !== '' && chat.name !== '(Sem nome)';

    let mainName = '';
    let subTitle = '';

    if (hasSavedName) {
      mainName = chat.name.trim();
      subTitle = `+${cleanPhone}`;
    } else {
      mainName = formatPhoneNumber(cleanPhone);
      subTitle = 'Número não salvo no catálogo';
    }

    return {
      mainName,
      subTitle,
      cleanPhone,
      isGroup,
      hasSavedName
    };
  }

  // ---------------------------------------------------------------------------
  // 6. RENDERIZAR CHATS
  // ---------------------------------------------------------------------------
  function renderChatsList(chatsToRender) {
    const savedScrollTop = chatsListEl.scrollTop;
    chatsListEl.innerHTML = '';

    if (!chatsToRender || chatsToRender.length === 0) {
      chatsListEl.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
        Nenhum contato encontrado
      </div>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    chatsToRender.forEach(chat => {
      const isUnread = (chat.unreadCount && chat.unreadCount > 0) || chat.unread === true;
      const item = document.createElement('div');
      item.className = `chat-item ${activeChat && activeChat.id === chat.id ? 'active' : ''} ${isUnread ? 'unread' : ''}`;
      item.dataset.id = chat.id;

      const info = getContactDisplayInfo(chat);

      // Avatar Initials
      const initial = info.mainName ? info.mainName.trim().charAt(0).toUpperCase() : '?';
      const bgIndex = Math.abs(hashCode(info.mainName)) % 6;
      const avatarColors = ['#008069', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

      // Formatar Timestamp da mensagem/atividade mais recente
      let timeText = '';
      const ts = getChatTimestampInSeconds(chat);
      if (ts > 0) {
        timeText = formatTimestamp(ts);
      }

      let unreadBadgeHtml = '';
      if (isUnread) {
        const countText = (chat.unreadCount && chat.unreadCount > 1) ? chat.unreadCount : '1';
        unreadBadgeHtml = `<span class="unread-badge" title="Mensagem não lida">${countText}</span>`;
      }

      let bottomRowHtml = '';
      if (chat.lastMessagePreview) {
        bottomRowHtml = `
          <span class="chat-preview-text" title="${escapeHtml(chat.lastMessagePreview)}">
            ${chat.lastMessageFromMe ? '<i class="ph-bold ph-checks preview-check"></i>' : ''}
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(chat.lastMessagePreview)}</span>
          </span>
          ${unreadBadgeHtml}
        `;
      } else {
        bottomRowHtml = `
          <span class="chat-id-text">${escapeHtml(info.subTitle)}</span>
          ${unreadBadgeHtml}
        `;
      }

      item.innerHTML = `
        <div class="avatar" style="background-color: ${avatarColors[bgIndex]}">
          ${info.isGroup ? '<i class="ph-bold ph-users"></i>' : initial}
        </div>
        <div class="chat-info">
          <div class="chat-top-row">
            <span class="chat-name">${escapeHtml(info.mainName)}</span>
            <span class="chat-time">${timeText}</span>
          </div>
          <div class="chat-bottom-row">
            ${bottomRowHtml}
          </div>
        </div>
      `;

      item.addEventListener('click', () => selectChat(chat));
      fragment.appendChild(item);
    });

    chatsListEl.appendChild(fragment);
    chatsListEl.scrollTop = savedScrollTop;

    // Adicionar botão de carregar mais se houver mais conversas no servidor e não estiver em streaming ativo e não atingiu limite 150
    if (hasMoreChats && searchInput.value.trim() === '' && !isStreamingChunks && allChats.length < MAX_CONTACTS) {
      const loadBtnContainer = document.createElement('div');
      loadBtnContainer.style.cssText = 'padding: 12px; text-align: center;';
      loadBtnContainer.innerHTML = `
        <button id="btn-more-chats" style="background: var(--bg-search-input); color: var(--text-primary); border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 20px; font-size: 0.8rem; cursor: pointer;">
          Carregar mais conversas...
        </button>
      `;
      chatsListEl.appendChild(loadBtnContainer);

      document.getElementById('btn-more-chats').addEventListener('click', loadMoreChats);
    }
  }

  // ---------------------------------------------------------------------------
  // 7. PESQUISA EM TEMPO REAL
  // ---------------------------------------------------------------------------
  function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();

    if (!query) {
      clearSearchBtn.classList.add('hidden');
      activeFilterTag.style.display = 'none';
      chatsCountTextEl.textContent = `${allChats.length} conversas carregadas`;
      renderChatsList(allChats);
    } else {
      clearSearchBtn.classList.remove('hidden');
      activeFilterTag.style.display = 'inline-block';

      const cleanQuery = query.replace(/[^0-9a-z]/gi, '');

      const filtered = allChats.filter(chat => {
        const name = (chat.name || '').toLowerCase();
        const id = (chat.id || '').toLowerCase();
        return name.includes(query) || id.includes(query) || id.includes(cleanQuery);
      });

      chatsCountTextEl.textContent = `${filtered.length} encontrados`;
      renderChatsList(filtered);
    }
  }

  // ---------------------------------------------------------------------------
  // ENVIAR STATUS DE VISUALIZADO (SEND SEEN / MARCAR VISTO NO WHATSAPP)
  // ---------------------------------------------------------------------------
  async function sendSeenStatus(chatId) {
    if (!chatId) return;
    try {
      await fetch('/api/send-seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId })
      });
    } catch (e) {
      // Ignora erro silencioso de visto
    }
  }

  // ---------------------------------------------------------------------------
  // 8. SELECIONAR CHAT E CARREGAR MENSAGENS (INSTANTÂNEO COM MENSAGENS PRÉ-CARREGADAS)
  // ---------------------------------------------------------------------------
  async function selectChat(chat) {
    activeChat = chat;

    // Limpar o sinalizador de não lido
    chat.unreadCount = 0;
    chat.unread = false;

    // Enviar status de visto/visualizado para o WhatsApp via WAHA
    sendSeenStatus(chat.id);

    // Mover o chat selecionado para o TOPO ABSOLUTO (#1) e re-renderizar
    sortChatsDescending(allChats);
    renderChatsList(allChats);

    // Mostrar container ativo imediatamente
    emptyStateEl.classList.add('hidden');
    activeChatContainerEl.classList.remove('hidden');

    // Atualizar Header do Chat
    const info = getContactDisplayInfo(chat);
    const initial = info.mainName ? info.mainName.trim().charAt(0).toUpperCase() : '?';

    activeChatNameEl.textContent = info.mainName;
    activeChatIdEl.textContent = info.hasSavedName ? `+${info.cleanPhone}` : 'Contato do WhatsApp';
    activeAvatarEl.textContent = initial;

    // Se as mensagens já estiverem no cache, exibe INSTANTANEAMENTE (0ms)!
    if (messagesCache.has(chat.id)) {
      renderMessages(messagesCache.get(chat.id));
      loadMessages(chat.id, false);
    } else {
      messagesContainerEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">
        Carregando mensagens...
      </div>`;
      await loadMessages(chat.id, true);
    }
  }

  // ---------------------------------------------------------------------------
  // 9. CARREGAR MENSAGENS DE UM CHAT (COM CACHE EM MEMÓRIA)
  // ---------------------------------------------------------------------------
  async function loadMessages(chatId, shouldRender = true) {
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages?limit=50`);

      if (!res.ok) throw new Error('Falha ao obter mensagens');

      const messages = await res.json();

      if (Array.isArray(messages)) {
        messagesCache.set(chatId, messages);

        if (messages.length > 0) {
          const latestMsg = getLatestMessageFromList(messages);
          const targetChat = allChats.find(c => c.id === chatId);
          if (targetChat && latestMsg) {
            targetChat.lastMessagePreview = formatPreviewFromMessage(latestMsg);
            targetChat.lastMessageFromMe = latestMsg.fromMe === true;
            targetChat.lastActivity = Number(latestMsg.timestamp || 0);
            sortChatsDescending(allChats);
            renderChatsList(allChats);
          }
        }

        if (shouldRender || (activeChat && activeChat.id === chatId)) {
          renderMessages(messages);
        }
      }
    } catch (err) {
      if (shouldRender && activeChat && activeChat.id === chatId && !messagesCache.has(chatId)) {
        messagesContainerEl.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 20px;">
          Erro ao carregar mensagens: ${err.message}
        </div>`;
      }
    }
  }

  function getMediaInfoFromMsg(msg) {
    let mediaUrl = null;
    let mimetype = '';
    let filename = msg.filename || msg.caption || msg.body || '';

    if (msg.media && msg.media.url) {
      mediaUrl = msg.media.url;
      mimetype = msg.media.mimetype || '';
    } else if (msg.mediaUrl) {
      mediaUrl = msg.mediaUrl;
    } else if (msg._data && msg._data.Message) {
      const m = msg._data.Message;
      if (m.imageMessage) {
        mimetype = m.imageMessage.mimetype || 'image/jpeg';
        filename = m.imageMessage.caption || filename || 'Foto.jpg';
        if (m.imageMessage.URL) mediaUrl = m.imageMessage.URL;
      } else if (m.documentMessage) {
        mimetype = m.documentMessage.mimetype || 'application/pdf';
        filename = m.documentMessage.title || m.documentMessage.fileName || filename || 'Documento.pdf';
        if (m.documentMessage.URL) mediaUrl = m.documentMessage.URL;
      } else if (m.audioMessage) {
        mimetype = m.audioMessage.mimetype || 'audio/ogg';
        if (m.audioMessage.URL) mediaUrl = m.audioMessage.URL;
      }
    }

    if (mediaUrl && mediaUrl.includes('/api/files/')) {
      const parts = mediaUrl.split('/api/files/');
      mediaUrl = `/api/files/${parts[1]}`;
    }

    if (!mimetype) {
      const lower = filename.toLowerCase();
      if (msg.type === 'image' || lower.endsWith('.jpg') || lower.endsWith('.png') || lower.endsWith('.jpeg')) mimetype = 'image/jpeg';
      else if (msg.type === 'document' || lower.endsWith('.pdf')) mimetype = 'application/pdf';
      else if (msg.type === 'audio' || msg.type === 'ptt' || lower.endsWith('.ogg') || lower.endsWith('.mp3')) mimetype = 'audio/ogg';
      else if (msg.type === 'video' || lower.endsWith('.mp4')) mimetype = 'video/mp4';
    }

    return { mediaUrl, mimetype, filename };
  }

  function renderMessages(messages) {
    messagesContainerEl.innerHTML = '';

    if (!messages || messages.length === 0) {
      messagesContainerEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px;">
        Nenhuma mensagem trocada recentemente. Digite uma mensagem abaixo para iniciar.
      </div>`;
      return;
    }

    // Ordenar cópia das mensagens por timestamp (antigas -> novas) sem mutar o array em memória
    const sortedMessages = [...messages].sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

    const fragment = document.createDocumentFragment();

    sortedMessages.forEach(msg => {
      const bubble = document.createElement('div');
      const isOutgoing = msg.fromMe === true;
      bubble.className = `message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;

      let bodyHtml = '';
      const { mediaUrl, mimetype, filename } = getMediaInfoFromMsg(msg);

      if (mimetype.startsWith('image/')) {
        if (mediaUrl) {
          const imgName = filename || 'Foto.jpg';
          bodyHtml += `<img src="${escapeHtml(mediaUrl)}" class="msg-img-preview" onclick="window.openFileViewer('${escapeHtml(mediaUrl)}', '${escapeHtml(imgName)}', '${escapeHtml(mimetype)}')" title="Clique para visualizar imagem" alt="Foto" />`;
        }
      } else if (mimetype.startsWith('audio/') || msg.type === 'ptt' || msg.type === 'audio') {
        if (mediaUrl) {
          bodyHtml += `<audio controls src="${escapeHtml(mediaUrl)}" class="msg-audio-player"></audio>`;
        }
      } else if (mimetype.startsWith('video/')) {
        if (mediaUrl) {
          bodyHtml += `<video controls src="${escapeHtml(mediaUrl)}" class="msg-video-player"></video>`;
        }
      } else if (msg.hasMedia || msg.type === 'document' || mimetype.includes('pdf')) {
        const docName = filename || 'Documento PDF';
        bodyHtml += `
          <div class="msg-file-box">
            <i class="ph-bold ph-file-pdf msg-file-icon"></i>
            <div class="msg-file-details">
              <span class="msg-file-name">${escapeHtml(docName)}</span>
              <span class="msg-file-sub">Arquivo / Documento PDF</span>
              ${mediaUrl ? `<button type="button" onclick="window.openFileViewer('${escapeHtml(mediaUrl)}', '${escapeHtml(docName)}', '${escapeHtml(mimetype)}')" class="msg-file-btn"><i class="ph-bold ph-eye"></i> Visualizar Arquivo</button>` : ''}
            </div>
          </div>
        `;
      }

      if (msg.body && !msg.hasMedia && !mimetype.startsWith('image/')) {
        bodyHtml += `<div class="msg-text">${escapeHtml(msg.body)}</div>`;
      } else if (msg.caption && (mimetype.startsWith('image/') || mimetype.startsWith('video/'))) {
        bodyHtml += `<div class="msg-text">${escapeHtml(msg.caption)}</div>`;
      }

      const timeText = msg.timestamp ? formatMessageTime(msg.timestamp) : '';

      bubble.innerHTML = `
        ${bodyHtml}
        <div class="msg-footer">
          <span class="msg-time">${timeText}</span>
          ${isOutgoing ? '<i class="ph-bold ph-checks" style="color: #53bdeb; font-size: 0.9rem;"></i>' : ''}
        </div>
      `;

      fragment.appendChild(bubble);
    });

    messagesContainerEl.appendChild(fragment);
    scrollToBottom();
  }

  // ---------------------------------------------------------------------------
  // 10. ENVIAR MENSAGEM (SEM TOAST DE SUCESSO - FEEDBACK VISUAL DIRETO)
  // ---------------------------------------------------------------------------
  async function sendMessage() {
    if (!activeChat) return;

    const text = messageTextInput.value.trim();

    if (!text && !selectedFile) {
      showToast('Digite uma mensagem ou selecione um arquivo.', 'error');
      return;
    }

    sendMsgBtn.disabled = true;
    sendMsgBtn.innerHTML = '<i class="ph-bold ph-spinner" style="animation: spin 1s infinite linear;"></i>';

    // Adicionar bolha de mensagem local imediatamente (Optimistic UI)
    if (text) {
      appendLocalMessage(text);
    }

    try {
      // 1. Se houver arquivo selecionado
      if (selectedFile) {
        const formData = new FormData();
        formData.append('chatId', activeChat.id);
        formData.append('file', selectedFile);
        if (text) formData.append('caption', text);

        const res = await fetch('/api/send-file', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          const errMsg = data.error?.exception?.message || data.error?.message || 'Erro ao enviar arquivo';
          throw new Error(errMsg);
        }

        clearFileSelection();
      }
      // 2. Apenas mensagem de texto
      else if (text) {
        const res = await fetch('/api/send-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: activeChat.id,
            text
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          const errMsg = data.error?.exception?.message || data.error?.message || 'Erro ao enviar texto';
          throw new Error(errMsg);
        }
      }

      messageTextInput.value = '';
      autoResizeTextarea();

      // Recarregar histórico de mensagens em segundo plano
      setTimeout(() => loadMessages(activeChat.id), 1200);

    } catch (err) {
      showToast(`Erro ao enviar: ${err.message}. Clique no botão 'Liga/Desliga' no topo para reiniciar a sessão se necessário.`, 'error');
    } finally {
      sendMsgBtn.disabled = false;
      sendMsgBtn.innerHTML = '<i class="ph-bold ph-paper-plane-right"></i>';
    }
  }

  function appendLocalMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble outgoing';
    const now = new Date();
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const timeText = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    bubble.innerHTML = `
      <div class="msg-text">${escapeHtml(text)}</div>
      <div class="msg-footer">
        <span class="msg-time">${timeText}</span>
        <i class="ph-bold ph-checks" style="color: #53bdeb; font-size: 0.9rem;"></i>
      </div>
    `;

    messagesContainerEl.appendChild(bubble);
    scrollToBottom();

    if (activeChat) {
      activeChat.lastActivity = nowSeconds;
      activeChat.conversationTimestamp = nowSeconds;
      activeChat.lastMessagePreview = text;
      activeChat.lastMessageFromMe = true;

      // Adicionar ao cache em memória
      let cached = messagesCache.get(activeChat.id) || [];
      cached.push({
        id: `local_${Date.now()}`,
        timestamp: nowSeconds,
        fromMe: true,
        body: text,
        hasMedia: false,
        type: 'chat'
      });
      messagesCache.set(activeChat.id, cached);

      // Re-ordenar e renderizar lista de contatos
      sortChatsDescending(allChats);
      renderChatsList(allChats);
    }
  }

  // ---------------------------------------------------------------------------
  // 11. EVENT LISTENERS E GERENCIAMENTO
  // ---------------------------------------------------------------------------
  function setupEventListeners() {
    // Pesquisa
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      handleSearch();
    });

    // Auto-expandir textarea e Enter para enviar
    messageTextInput.addEventListener('input', autoResizeTextarea);
    messageTextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Tecla ESC para fechar modal de visualização, modal de nova conversa ou sair da conversa ativa
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        const viewerModal = document.getElementById('file-viewer-modal');
        if (viewerModal && !viewerModal.classList.contains('hidden')) {
          window.closeFileViewer();
          return;
        }

        if (newChatModal && !newChatModal.classList.contains('hidden')) {
          newChatModal.classList.add('hidden');
          return;
        }

        if (activeChat) {
          deselectActiveChat();
        }
      }
    });

    // Eventos do Modal Visualizador de Arquivo
    const closeViewerBtn = document.getElementById('close-viewer-btn');
    const fileViewerModal = document.getElementById('file-viewer-modal');
    if (closeViewerBtn) closeViewerBtn.addEventListener('click', window.closeFileViewer);
    if (fileViewerModal) {
      fileViewerModal.addEventListener('click', (e) => {
        if (e.target === fileViewerModal) window.closeFileViewer();
      });
    }

    sendMsgBtn.addEventListener('click', sendMessage);

    // Infinite scroll na lista de chats
    chatsListEl.addEventListener('scroll', () => {
      if (chatsListEl.scrollTop + chatsListEl.clientHeight >= chatsListEl.scrollHeight - 50) {
        loadMoreChats();
      }
    });

    // Seleção de Arquivo
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        selectedFile = e.target.files[0];
        previewFilenameEl.textContent = selectedFile.name;
        previewFilesizeEl.textContent = formatBytes(selectedFile.size);
        filePreviewPanel.classList.remove('hidden');
      }
    });

    removeFileBtn.addEventListener('click', clearFileSelection);

    // Modal Nova Conversa
    newChatBtn.addEventListener('click', () => {
      newNumberInput.value = '';
      newChatModal.classList.remove('hidden');
      newNumberInput.focus();
    });

    restartSessionBtn.addEventListener('click', restartSession);

    closeModalBtn.addEventListener('click', () => newChatModal.classList.add('hidden'));
    cancelModalBtn.addEventListener('click', () => newChatModal.classList.add('hidden'));

    startChatBtn.addEventListener('click', () => {
      let rawNumber = newNumberInput.value.trim().replace(/[^0-9]/g, '');
      if (!rawNumber) {
        showToast('Insira um número válido com DDD', 'error');
        return;
      }
      if (!rawNumber.includes('@')) {
        rawNumber += '@c.us';
      }

      const customChat = { id: rawNumber, name: '' };
      selectChat(customChat);
      newChatModal.classList.add('hidden');
    });

    // Botões de atualizar
    refreshChatsBtn.addEventListener('click', () => {
      loadInitialChats();
      showToast('Lista de conversas atualizada');
    });

    refreshMessagesBtn.addEventListener('click', () => {
      if (activeChat) loadMessages(activeChat.id);
    });

    copyNumberBtn.addEventListener('click', () => {
      if (activeChat) {
        const cleanPhone = activeChat.id.replace('@c.us', '').replace('@g.us', '');
        navigator.clipboard.writeText(`+${cleanPhone}`);
        showToast('Número copiado para a área de transferência!');
      }
    });

    // Tema Claro / Escuro
    toggleThemeBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      toggleThemeBtn.innerHTML = newTheme === 'light' ? '<i class="ph-bold ph-sun"></i>' : '<i class="ph-bold ph-moon"></i>';
    });
  }

  // ---------------------------------------------------------------------------
  // VISUALIZADOR DE ARQUIVOS (IN-SITE PREVIEW MODAL)
  // ---------------------------------------------------------------------------
  window.openFileViewer = function(mediaUrl, filename, mimetype) {
    if (!mediaUrl) return;

    const modal = document.getElementById('file-viewer-modal');
    const filenameEl = document.getElementById('viewer-filename');
    const downloadBtn = document.getElementById('viewer-download-btn');
    const bodyEl = document.getElementById('viewer-content-body');
    const iconEl = document.getElementById('viewer-icon');

    if (!modal || !bodyEl) return;

    const safeName = filename || 'Arquivo';
    if (filenameEl) filenameEl.textContent = safeName;
    if (downloadBtn) {
      downloadBtn.href = mediaUrl;
      downloadBtn.setAttribute('download', safeName);
    }

    bodyEl.innerHTML = '';
    const mime = (mimetype || '').toLowerCase();
    const nameLower = safeName.toLowerCase();

    if (mime.startsWith('image/') || nameLower.endsWith('.jpg') || nameLower.endsWith('.png') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.webp') || nameLower.endsWith('.gif')) {
      if (iconEl) iconEl.className = 'ph-bold ph-image';
      bodyEl.innerHTML = `<img src="${escapeHtml(mediaUrl)}" class="viewer-media-img" alt="${escapeHtml(safeName)}" />`;
    } else if (mime.includes('pdf') || nameLower.endsWith('.pdf')) {
      if (iconEl) iconEl.className = 'ph-bold ph-file-pdf';
      bodyEl.innerHTML = `<iframe src="${escapeHtml(mediaUrl)}" class="viewer-pdf-iframe" title="${escapeHtml(safeName)}"></iframe>`;
    } else if (mime.startsWith('video/') || nameLower.endsWith('.mp4') || nameLower.endsWith('.webm')) {
      if (iconEl) iconEl.className = 'ph-bold ph-video-camera';
      bodyEl.innerHTML = `<video src="${escapeHtml(mediaUrl)}" controls autoplay class="viewer-media-video"></video>`;
    } else if (mime.startsWith('audio/') || nameLower.endsWith('.mp3') || nameLower.endsWith('.ogg') || nameLower.endsWith('.wav')) {
      if (iconEl) iconEl.className = 'ph-bold ph-music-notes';
      bodyEl.innerHTML = `<audio src="${escapeHtml(mediaUrl)}" controls autoplay class="viewer-media-audio"></audio>`;
    } else {
      if (iconEl) iconEl.className = 'ph-bold ph-file-text';
      bodyEl.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-main);">
          <i class="ph-bold ph-file-text" style="font-size: 3.5rem; color: var(--blue-500); margin-bottom: 16px;"></i>
          <h4 style="font-size: 1.1rem; margin-bottom: 8px;">${escapeHtml(safeName)}</h4>
          <p style="font-size: 0.85rem; color: var(--text-sub); margin-bottom: 24px;">Pré-visualização direta não disponível para este formato.</p>
          <a href="${escapeHtml(mediaUrl)}" download="${escapeHtml(safeName)}" class="btn btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
            <i class="ph-bold ph-download-simple"></i> Baixar Arquivo
          </a>
        </div>
      `;
    }

    modal.classList.remove('hidden');
  };

  window.closeFileViewer = function() {
    const modal = document.getElementById('file-viewer-modal');
    const bodyEl = document.getElementById('viewer-content-body');
    if (modal) modal.classList.add('hidden');
    if (bodyEl) bodyEl.innerHTML = '';
  };

  // ---------------------------------------------------------------------------
  // HELPERS E UTILITÁRIOS
  // ---------------------------------------------------------------------------
  function clearFileSelection() {
    selectedFile = null;
    fileInput.value = '';
    filePreviewPanel.classList.add('hidden');
  }

  function deselectActiveChat() {
    activeChat = null;
    if (activeChatContainerEl) activeChatContainerEl.classList.add('hidden');
    if (emptyStateEl) emptyStateEl.classList.remove('hidden');
    document.querySelectorAll('.chat-item.active').forEach(el => el.classList.remove('active'));
    clearFileSelection();
  }

  function autoResizeTextarea() {
    messageTextInput.style.height = 'auto';
    messageTextInput.style.height = Math.min(messageTextInput.scrollHeight, 120) + 'px';
  }

  function scrollToBottom() {
    setTimeout(() => {
      messagesContainerEl.scrollTop = messagesContainerEl.scrollHeight;
    }, 50);
  }

  function formatTimestamp(ts) {
    if (!ts) return '';
    const ms = ts > 1e11 ? ts : ts * 1000;
    const date = new Date(ms);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  function formatMessageTime(ts) {
    if (!ts) return '';
    const ms = ts > 1e11 ? ts : ts * 1000;
    const date = new Date(ms);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatPhoneNumber(phone) {
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length === 13 && clean.startsWith('55')) {
      return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    } else if (clean.length === 12 && clean.startsWith('55')) {
      return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
    }
    return `+${clean}`;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="ph-bold ${type === 'error' ? 'ph-warning-circle' : 'ph-check-circle'}"></i>
      <span>${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

});
