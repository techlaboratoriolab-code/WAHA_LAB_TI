document.addEventListener('DOMContentLoaded', () => {
  // ---------------------------------------------------------------------------
  // ESTADO GLOBAL DA APLICAÇÃO
  // ---------------------------------------------------------------------------
  let activeChat = null;        // Chat selecionado ({ id, name })
  let chats = [];               // Lista de chats carregados
  let filteredChats = [];       // Lista filtrada na busca
  let selectedFile = null;      // Arquivo selecionado no anexo
  let sseEventSource = null;    // Conexão SSE para tempo real

  let currentLimit = 50;        // Paginação inicial
  let currentOffset = 0;
  let hasMoreChats = true;
  let isLoadingChats = false;

  // ---------------------------------------------------------------------------
  // ELEMENTOS DO DOM
  // ---------------------------------------------------------------------------
  const sessionNameEl = document.getElementById('session-name');
  const sessionStatusEl = document.getElementById('session-status');
  const sessionStatusTextEl = document.getElementById('session-status-text');

  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const chatsCountTextEl = document.getElementById('chats-count-text');
  const activeFilterTagEl = document.getElementById('active-filter-tag');
  const chatsListEl = document.getElementById('chats-list');

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

  const replyPreviewBar = document.getElementById('reply-preview-bar');
  const replyPreviewTitle = document.getElementById('reply-preview-title');
  const replyPreviewText = document.getElementById('reply-preview-text');
  const cancelReplyBtn = document.getElementById('cancel-reply-btn');

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

  // ---------------------------------------------------------------------------
  // GESTÃO DE RESPOSTA / CITAÇÃO DE MENSAGENS (REPLY / QUOTE)
  // ---------------------------------------------------------------------------
  let replyingToMsg = null;

  function setReplyMessage(msg) {
    if (!msg) return;
    replyingToMsg = msg;

    let senderName = 'Contato';
    if (msg.fromMe === true) {
      senderName = 'Eu';
    } else if (msg.sender) {
      const clean = msg.sender.replace(/[^0-9]/g, '');
      if (clean.includes('67349533163598') || clean.includes('556132453766')) {
        senderName = 'Eu';
      } else {
        senderName = clean.length > 8 ? formatPhoneNumber(clean) : msg.sender;
      }
    } else if (activeChat) {
      senderName = activeChat.name || formatPhoneNumber(activeChat.id.replace('@c.us', ''));
    }

    let previewText = msg.body || msg.caption || '';
    if (!previewText) {
      const { mimetype } = getMediaInfoFromMsg(msg);
      if (mimetype.startsWith('image/')) previewText = '📷 Foto';
      else if (mimetype.startsWith('audio/') || msg.type === 'ptt' || msg.type === 'audio') previewText = '🎵 Áudio';
      else if (mimetype.startsWith('video/')) previewText = '🎥 Vídeo';
      else if (msg.hasMedia || msg.type === 'document' || mimetype.includes('pdf')) previewText = '📄 Documento PDF';
      else previewText = '📎 Mídia';
    }

    if (replyPreviewTitle) {
      replyPreviewTitle.innerHTML = `<i class="ph-bold ph-quotes"></i> Respondendo a ${escapeHtml(senderName)}`;
    }
    if (replyPreviewText) {
      replyPreviewText.textContent = previewText;
    }
    if (replyPreviewBar) {
      replyPreviewBar.classList.remove('hidden');
    }
    if (messageTextInput) {
      messageTextInput.focus();
    }
  }

  function clearReplyMessage() {
    replyingToMsg = null;
    if (replyPreviewBar) {
      replyPreviewBar.classList.add('hidden');
    }
  }

  // ---------------------------------------------------------------------------
  // INICIALIZAÇÃO CONTROLADA VIA AUTENTICAÇÃO FLOW LAB
  // ---------------------------------------------------------------------------
  let appStarted = false;

  window.startWahaApp = function () {
    if (appStarted) return;
    appStarted = true;
    checkSessionStatus();
    loadInitialChats();
    setupEventListeners();
    setupRealtimeEvents();
    startSmartPollingSync();
    refreshLucideIcons();
  };

  window.stopWahaApp = function () {
    appStarted = false;
    if (sseEventSource) {
      try { sseEventSource.close(); } catch (e) { }
      sseEventSource = null;
    }
  };

  function refreshLucideIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try { window.lucide.createIcons(); } catch (e) { }
    }
  }

  // ---------------------------------------------------------------------------
  // HELPERS DE MENSAGENS E PREVIEW RECENTE
  // ---------------------------------------------------------------------------
  function getLatestMessageFromList(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return null;
    return [...messages].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))[0];
  }

  function extractPreviewFromMessage(msg) {
    if (!msg) return '';
    let preview = msg.body || '';
    if (msg.hasMedia || msg.type === 'document' || msg.type === 'image' || msg.type === 'ptt' || msg.type === 'audio' || msg.type === 'video' || msg.type === 'sticker') {
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
  // STATUS DA SESSÃO WAHA
  // ---------------------------------------------------------------------------
  async function checkSessionStatus() {
    try {
      const res = await fetch('/api/session-status');
      if (!res.ok) throw new Error('Falha ao consultar status da sessão');

      const data = await res.json();
      const session = data.session || {};
      const status = (session.status || 'OFFLINE').toUpperCase();

      if (sessionNameEl) sessionNameEl.textContent = 'Lab Atendimento';
      if (sessionStatusTextEl) sessionStatusTextEl.textContent = status;

      if (status === 'WORKING' || status === 'CONNECTED') {
        sessionStatusEl.className = 'status-badge connected';
      } else {
        sessionStatusEl.className = 'status-badge';
      }
    } catch (err) {
      console.error('Erro no checkSessionStatus:', err);
      if (sessionStatusEl) sessionStatusEl.className = 'status-badge';
      if (sessionStatusTextEl) sessionStatusTextEl.textContent = 'Conectando...';
    }
  }

  async function restartSession() {
    showToast('Reiniciando conexão com a sessão...', 'info');
    try {
      const res = await fetch('/api/restart-session', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Sessão reiniciada com sucesso!');
        setTimeout(checkSessionStatus, 2000);
      } else {
        showToast('Falha ao reiniciar sessão', 'error');
      }
    } catch (err) {
      showToast('Erro ao comunicar com o servidor', 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // TEMPO REAL COM SSE (SERVER-SENT EVENTS) E POLLING DE BACKUP
  // ---------------------------------------------------------------------------
  function setupRealtimeEvents() {
    try {
      if (sseEventSource) sseEventSource.close();
      sseEventSource = new EventSource('/api/events');

      sseEventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event === 'message' && parsed.data) {
            handleIncomingRealtimeMessage(parsed.data);
          }
        } catch (e) {
          console.error('Erro ao processar evento SSE:', e);
        }
      };

      sseEventSource.onerror = () => {
        console.warn('Conexão SSE caiu. O polling garantirá a atualização.');
      };
    } catch (e) {
      console.error('Erro ao conectar SSE:', e);
    }
  }

  function handleIncomingRealtimeMessage(eventData) {
    const { chatId, message, preview, fromMe, timestamp } = eventData;
    if (!chatId) return;

    let existingChat = chats.find(c => c.id === chatId);
    if (existingChat) {
      existingChat.lastMessagePreview = preview || extractPreviewFromMessage(message);
      existingChat.lastMessageFromMe = fromMe;
      existingChat.lastActivity = timestamp || Math.floor(Date.now() / 1000);
      if (activeChat && activeChat.id === chatId && !fromMe) {
        // Já aberto
      } else if (!fromMe) {
        existingChat.unreadCount = (existingChat.unreadCount || 0) + 1;
      }
    } else {
      const newChatObj = {
        id: chatId,
        name: message?.sender?.pushname || formatPhoneNumber(chatId.replace('@c.us', '')),
        unreadCount: fromMe ? 0 : 1,
        lastMessagePreview: preview || extractPreviewFromMessage(message),
        lastMessageFromMe: fromMe,
        lastActivity: timestamp || Math.floor(Date.now() / 1000)
      };
      chats.unshift(newChatObj);
    }

    chats.sort((a, b) => (Number(b.lastActivity) || 0) - (Number(a.lastActivity) || 0));
    renderChatsList(searchInput.value.trim() !== '' ? filterChatsLocally(searchInput.value.trim()) : chats);

    if (activeChat && activeChat.id === chatId) {
      loadMessages(chatId, true);
      markChatAsSeen(chatId);
    }
  }

  let isPollingActive = false;

  async function syncRecentChatsSilently() {
    try {
      const res = await fetch('/api/chats?limit=25&offset=0');
      if (!res.ok) return;

      const recentChats = await res.json();
      if (!Array.isArray(recentChats)) return;

      let changed = false;

      recentChats.forEach(incoming => {
        let existing = chats.find(c => c.id === incoming.id);
        if (!existing) {
          chats.push(incoming);
          changed = true;
        } else {
          if (incoming.lastActivity && incoming.lastActivity !== existing.lastActivity) {
            existing.lastActivity = incoming.lastActivity;
            changed = true;
          }
          if (incoming.lastMessagePreview && incoming.lastMessagePreview !== existing.lastMessagePreview) {
            existing.lastMessagePreview = incoming.lastMessagePreview;
            changed = true;
          }
          if (typeof incoming.unreadCount === 'number' && incoming.unreadCount !== existing.unreadCount) {
            if (activeChat && activeChat.id === incoming.id) {
              existing.unreadCount = 0;
            } else {
              existing.unreadCount = incoming.unreadCount;
              changed = true;
            }
          }
        }
      });

      if (changed) {
        chats.sort((a, b) => (Number(b.lastActivity || b.conversationTimestamp) || 0) - (Number(a.lastActivity || a.conversationTimestamp) || 0));
        const query = searchInput.value.trim();
        renderChatsList(query ? filterChatsLocally(query) : chats);
      }
    } catch (err) {
      console.warn('Erro ao sincronizar chats silenciosamente:', err);
    }
  }

  function startSmartPollingSync() {
    setInterval(async () => {
      if (isPollingActive) return;
      isPollingActive = true;
      try {
        await checkSessionStatus();
        await syncRecentChatsSilently();
        if (activeChat) {
          await loadMessages(activeChat.id, true);
        }
      } catch (e) {
        console.warn('Erro no ciclo de polling:', e);
      } finally {
        isPollingActive = false;
      }
    }, 4000);
  }

  // ---------------------------------------------------------------------------
  // CARREGAMENTO E RENDERIZAÇÃO DE CHATS (COM PAGINAÇÃO)
  // ---------------------------------------------------------------------------
  async function loadInitialChats() {
    currentOffset = 0;
    hasMoreChats = true;
    chats = [];
    await fetchChatsChunk();
  }

  async function loadMoreChats() {
    if (isLoadingChats || !hasMoreChats) return;
    currentOffset += currentLimit;
    await fetchChatsChunk();
  }

  async function fetchChatsChunk() {
    isLoadingChats = true;
    try {
      const res = await fetch(`/api/chats?limit=${currentLimit}&offset=${currentOffset}&sortBy=conversationTimestamp&sortOrder=desc`);
      if (!res.ok) throw new Error('Falha ao carregar lista de conversas');

      const chunk = await res.json();
      if (!Array.isArray(chunk) || chunk.length === 0) {
        hasMoreChats = false;
        if (chats.length === 0) {
          chatsListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted-custom); font-size: 0.85rem;">Nenhuma conversa encontrada na sessão.</div>';
        }
        isLoadingChats = false;
        return;
      }

      if (chunk.length < currentLimit) {
        hasMoreChats = false;
      }

      chunk.forEach(newChat => {
        if (!chats.some(c => c.id === newChat.id)) {
          chats.push(newChat);
        }
      });

      chats.sort((a, b) => (Number(b.lastActivity || b.conversationTimestamp) || 0) - (Number(a.lastActivity || a.conversationTimestamp) || 0));

      const query = searchInput.value.trim();
      renderChatsList(query ? filterChatsLocally(query) : chats);
    } catch (err) {
      console.error('Erro ao carregar chats:', err);
      if (chats.length === 0) {
        chatsListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--danger-500); font-size: 0.85rem;">Erro ao conectar com a sessão WAHA.</div>';
      }
    } finally {
      isLoadingChats = false;
    }
  }

  function filterChatsLocally(query) {
    const q = query.toLowerCase();
    return chats.filter(chat => {
      const name = (chat.name || '').toLowerCase();
      const id = (chat.id || '').toLowerCase();
      const phone = id.replace(/[^0-9]/g, '');
      return name.includes(q) || id.includes(q) || phone.includes(q);
    });
  }

  function renderChatsList(chatsToRender) {
    chatsCountTextEl.textContent = `${chatsToRender.length} conversa${chatsToRender.length !== 1 ? 's' : ''}`;
    
    if (chatsToRender.length === 0) {
      chatsListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted-custom); font-size: 0.85rem;">Nenhum resultado encontrado.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();

    chatsToRender.forEach(chat => {
      const chatItem = document.createElement('div');
      chatItem.className = 'chat-item';
      if (activeChat && activeChat.id === chat.id) {
        chatItem.classList.add('active');
      }
      if (chat.unreadCount > 0) {
        chatItem.classList.add('unread');
      }

      const rawNumber = chat.id.replace('@c.us', '').replace('@g.us', '');
      const displayName = chat.name || formatPhoneNumber(rawNumber);
      const avatarInitial = displayName.charAt(0).toUpperCase();

      const bgHue = Math.abs(hashCode(chat.id)) % 360;
      const avatarStyle = `background: hsl(${bgHue}, 60%, 40%);`;

      const lastTime = formatTimestamp(chat.lastActivity || chat.conversationTimestamp);
      
      let previewText = chat.lastMessagePreview || 'Mensagem sem prévia';
      if (chat.lastMessageFromMe) {
        previewText = `Você: ${previewText}`;
      }

      chatItem.innerHTML = `
        <div class="avatar" style="${avatarStyle}">${avatarInitial}</div>
        <div class="chat-info">
          <div class="chat-top-row">
            <span class="chat-name">${escapeHtml(displayName)}</span>
            <span class="chat-time">${lastTime}</span>
          </div>
          <div class="chat-bottom-row">
            <span class="chat-preview-text" title="${escapeHtml(previewText)}">${escapeHtml(previewText)}</span>
            ${chat.unreadCount > 0 ? `<span class="unread-badge">${chat.unreadCount}</span>` : ''}
          </div>
        </div>
      `;

      chatItem.addEventListener('click', () => selectChat(chat));
      fragment.appendChild(chatItem);
    });

    chatsListEl.innerHTML = '';
    chatsListEl.appendChild(fragment);
  }

  let lastRenderedChatId = null;
  let lastRenderedSignature = '';

  // ---------------------------------------------------------------------------
  // SELEÇÃO E NAVEGAÇÃO DE CHAT
  // ---------------------------------------------------------------------------
  async function selectChat(chat) {
    clearReplyMessage();
    lastRenderedChatId = chat.id;
    lastRenderedSignature = '';

    activeChat = chat;
    activeChat.unreadCount = 0;

    const rawNumber = chat.id.replace('@c.us', '').replace('@g.us', '');
    const displayName = chat.name || formatPhoneNumber(rawNumber);

    activeChatNameEl.textContent = displayName;
    activeChatIdEl.textContent = `+${rawNumber}`;
    activeAvatarEl.textContent = displayName.charAt(0).toUpperCase();

    const bgHue = Math.abs(hashCode(chat.id)) % 360;
    activeAvatarEl.style.cssText = `background: hsl(${bgHue}, 60%, 40%);`;

    emptyStateEl.classList.add('hidden');
    activeChatContainerEl.classList.remove('hidden');

    renderChatsList(searchInput.value.trim() ? filterChatsLocally(searchInput.value.trim()) : chats);

    await loadMessages(chat.id);
    markChatAsSeen(chat.id);
    
    messageTextInput.focus();
  }

  async function markChatAsSeen(chatId) {
    try {
      await fetch('/api/send-seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId })
      });
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // MENSAGENS DO CHAT
  function getMsgId(m) {
    if (!m) return '';
    if (typeof m.id === 'object' && m.id) {
      return m.id._serialized || m.id.id || JSON.stringify(m.id);
    }
    if (typeof m.id === 'string' && m.id) {
      return m.id;
    }
    if (m.key && typeof m.key === 'object' && m.key.id) {
      return m.key.id;
    }
    return `${m.timestamp || ''}_${m.fromMe ? '1' : '0'}_${(m.body || m.caption || '').slice(0, 30)}`;
  }

  // ---------------------------------------------------------------------------
  async function loadMessages(chatId, silent = false) {
    try {
      if (!silent || lastRenderedChatId !== chatId) {
        messagesContainerEl.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--text-muted-custom);"><i class="ph-bold ph-spinner spinner" style="font-size: 1.5rem;"></i><p style="margin-top: 8px; font-size: 0.85rem;">Carregando histórico...</p></div>';
        lastRenderedSignature = '';
        lastRenderedChatId = chatId;
      }

      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages?limit=50`);
      if (!res.ok) throw new Error('Falha ao carregar mensagens');

      const messages = await res.json();
      
      if (activeChat && activeChat.id === chatId) {
        // Deduplica mensagens recebidas por ID único
        const uniqueMessages = [];
        const seenIds = new Set();
        (Array.isArray(messages) ? messages : []).forEach(m => {
          const idStr = getMsgId(m);
          if (!seenIds.has(idStr)) {
            seenIds.add(idStr);
            uniqueMessages.push(m);
          }
        });

        const sortedMessages = uniqueMessages.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
        
        const latest = sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1] : null;
        if (latest) {
          activeChat.lastMessagePreview = extractPreviewFromMessage(latest);
          activeChat.lastMessageFromMe = latest.fromMe === true;
          activeChat.lastActivity = latest.timestamp || activeChat.lastActivity;
        }

        const newSignature = sortedMessages.map(m => `${getMsgId(m)}_${m.timestamp || ''}_${m.ack || ''}`).join('|');

        // Se as mensagens forem exatamente as mesmas já exibidas, não re-renderiza o DOM (elimina o piscar)
        if (newSignature === lastRenderedSignature && messagesContainerEl.children.length > 0 && !messagesContainerEl.querySelector('.ph-spinner')) {
          return;
        }

        lastRenderedSignature = newSignature;
        const isNearBottom = messagesContainerEl.scrollHeight - messagesContainerEl.scrollTop - messagesContainerEl.clientHeight < 140;

        renderMessages(sortedMessages);
        
        if (!silent || isNearBottom) {
          scrollToBottom();
        }
      }
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
      if (!silent) {
        messagesContainerEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--danger-500); font-size: 0.85rem;">Não foi possível obter as mensagens.</div>';
      }
    }
  }

  function getMediaInfoFromMsg(msg) {
    let mediaUrl = null;
    let mimetype = msg.media?.mimetype || msg._data?.mimetype || '';
    let filename = msg.media?.filename || msg._data?.filename || '';

    if (msg.hasMedia || msg.type === 'image' || msg.type === 'document' || msg.type === 'audio' || msg.type === 'ptt' || msg.type === 'video') {
      let fileRelPath = msg.media?.url || msg._data?.url || msg.mediaUrl;
      
      if (!fileRelPath && msg.id) {
        fileRelPath = `${getMsgId(msg)}.bin`;
      }
      
      if (fileRelPath) {
        fileRelPath = fileRelPath.replace(/^.*\/files\//, '').replace(/^.*\/api\/files\//, '');
        mediaUrl = `/api/files/${fileRelPath}`;
      }
    }
    return { mediaUrl, mimetype, filename };
  }

  function extractQuotedMessage(msg) {
    if (!msg) return null;

    // 1. Estrutura oficial WAHA (msg.replyTo)
    if (msg.replyTo && typeof msg.replyTo === 'object') {
      const q = msg.replyTo;
      let text = q.body || '';
      if (!text && q._data) {
        text = q._data.conversation || q._data.extendedTextMessage?.text || q._data.imageMessage?.caption || q._data.videoMessage?.caption || q._data.documentMessage?.fileName || '';
      }
      if (!text) {
        if (q.hasMedia || q.media || q._data?.imageMessage) text = '📷 Foto';
        else if (q._data?.documentMessage) text = `📄 ${q._data.documentMessage.fileName || 'Documento PDF'}`;
        else if (q._data?.audioMessage || q.type === 'audio' || q.type === 'ptt') text = '🎵 Áudio';
        else if (q._data?.videoMessage) text = '🎥 Vídeo';
        else text = '📎 Mensagem com mídia';
      }
      const sender = q.participant || q.from || q._data?.participant || '';
      const fromMe = q.fromMe === true || q._data?.fromMe === true || (typeof q.id === 'string' && q.id.startsWith('true_')) || sender.includes('67349533163598') || sender.includes('556132453766');
      return { text, sender, fromMe };
    }

    // 2. Estrutura _data.quotedMsg (WAHA / Baileys / WWebJS)
    if (msg._data?.quotedMsg && typeof msg._data.quotedMsg === 'object') {
      const qm = msg._data.quotedMsg;
      let text = qm.body || qm.caption || '';
      if (!text && qm._data) {
        text = qm._data.conversation || qm._data.extendedTextMessage?.text || '';
      }
      if (!text) text = '📎 Mensagem';
      const sender = qm.author || qm.from || '';
      const fromMe = qm.fromMe === true || (typeof qm.id === 'string' && qm.id.startsWith('true_')) || sender.includes('67349533163598') || sender.includes('556132453766');
      return { text, sender, fromMe };
    }

    // 3. Estrutura estendida WhatsApp Web ContextInfo
    const contextInfo = msg._data?.Message?.extendedTextMessage?.contextInfo
                     || msg._data?.Message?.imageMessage?.contextInfo
                     || msg._data?.Message?.documentMessage?.contextInfo
                     || msg._data?.Message?.audioMessage?.contextInfo
                     || msg._data?.contextInfo;

    if (contextInfo && contextInfo.quotedMessage) {
      const qm = contextInfo.quotedMessage;
      let text = qm.conversation || qm.extendedTextMessage?.text || qm.imageMessage?.caption || qm.videoMessage?.caption || qm.documentMessage?.fileName || '';
      if (!text) {
        if (qm.imageMessage) text = '📷 Foto';
        else if (qm.documentMessage) text = `📄 ${qm.documentMessage.fileName || 'Documento PDF'}`;
        else if (qm.audioMessage || qm.pttMessage) text = '🎵 Áudio';
        else if (qm.videoMessage) text = '🎥 Vídeo';
        else text = '📎 Mensagem';
      }
      const sender = contextInfo.participant || '';
      const fromMe = contextInfo.fromMe === true || sender.includes('67349533163598') || sender.includes('556132453766');
      return { text, sender, fromMe };
    }

    return null;
  }

  function renderMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      messagesContainerEl.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-muted-custom);">
          <i class="ph-bold ph-chat-teardrop-dots" style="font-size: 2.5rem; margin-bottom: 12px;"></i>
          <p style="font-size: 0.9rem;">Nenhuma mensagem registrada nesta conversa.</p>
        </div>`;
      return;
    }

    // Deduplica e ordena mensagens antes de gerar os elementos no DOM
    const uniqueMessages = [];
    const seenIds = new Set();
    messages.forEach(m => {
      const idStr = getMsgId(m);
      if (!seenIds.has(idStr)) {
        seenIds.add(idStr);
        uniqueMessages.push(m);
      }
    });

    const sortedMessages = uniqueMessages.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
    const fragment = document.createDocumentFragment();

    sortedMessages.forEach(msg => {
      const isOutgoing = msg.fromMe === true;
      
      const row = document.createElement('div');
      row.className = `message-row ${isOutgoing ? 'outgoing' : 'incoming'}`;
      row.setAttribute('title', 'Clique duas vezes em qualquer lugar da linha para responder');

      const bubble = document.createElement('div');
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

      // Renderizar caixa de resposta/citação (Quoted Message / Reply)
      const quoted = extractQuotedMessage(msg);
      let quotedHtml = '';
      if (quoted && quoted.text) {
        let qSenderName = 'Mensagem Respondida';
        if (quoted.fromMe) {
          qSenderName = 'Eu';
        } else if (quoted.sender) {
          const cleanPhone = quoted.sender.replace(/[^0-9]/g, '');
          if (cleanPhone.includes('67349533163598') || cleanPhone.includes('556132453766')) {
            qSenderName = 'Eu';
          } else if (cleanPhone.length > 8) {
            qSenderName = formatPhoneNumber(cleanPhone);
          } else {
            qSenderName = quoted.sender;
          }
        }
        quotedHtml = `
          <div class="msg-quoted-box">
            <span class="msg-quoted-sender"><i class="ph-bold ph-quotes" style="margin-right: 4px;"></i>${escapeHtml(qSenderName)}</span>
            <span class="msg-quoted-text">${escapeHtml(quoted.text)}</span>
          </div>
        `;
      }

      const timeText = msg.timestamp ? formatMessageTime(msg.timestamp) : '';

      bubble.innerHTML = `
        ${quotedHtml}
        ${bodyHtml}
        <div class="msg-footer">
          <span class="msg-time">${timeText}</span>
          ${isOutgoing ? '<i class="ph-bold ph-checks" style="color: #53bdeb; font-size: 0.9rem;"></i>' : ''}
        </div>
      `;

      row.appendChild(bubble);

      // Clique duplo em QUALQUER ponto da linha da mensagem ativa a citação/resposta!
      row.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        setReplyMessage(msg);
      });

      fragment.appendChild(row);
    });

    messagesContainerEl.innerHTML = '';
    messagesContainerEl.appendChild(fragment);
  }

  // ---------------------------------------------------------------------------
  // ENVIAR MENSAGENS E ARQUIVOS (COM PROTEÇÃO CONTRA DUPLICAÇÃO)
  // ---------------------------------------------------------------------------
  let isSendingMessage = false;

  async function sendMessage() {
    if (!activeChat || isSendingMessage) return;

    const text = messageTextInput.value.trim();
    if (!text && !selectedFile) return;

    isSendingMessage = true;
    sendMsgBtn.disabled = true;
    messageTextInput.disabled = true;

    const originalText = messageTextInput.value;
    const fileToSend = selectedFile;
    const currentReplyMsg = replyingToMsg;

    // Limpa otimistamente os campos para evitar envios repetidos
    messageTextInput.value = '';
    clearFileSelection();
    clearReplyMessage();
    autoResizeTextarea();

    try {
      if (fileToSend) {
        const formData = new FormData();
        formData.append('chatId', activeChat.id);
        formData.append('file', fileToSend);
        if (text) formData.append('caption', text);
        if (currentReplyMsg) formData.append('replyTo', getMsgId(currentReplyMsg));

        const res = await fetch('/api/send-file', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();

        if (res.ok && data.success) {
          const fileNameStr = fileToSend.name;
          activeChat.lastMessagePreview = text ? `📄 ${fileNameStr}: ${text}` : `📄 ${fileNameStr}`;
          activeChat.lastMessageFromMe = true;
          activeChat.lastActivity = Math.floor(Date.now() / 1000);

          await loadMessages(activeChat.id, true);
          showToast('Arquivo enviado com sucesso!');
        } else {
          // Restaura texto original se falhar
          messageTextInput.value = originalText;
          if (currentReplyMsg) setReplyMessage(currentReplyMsg);
          autoResizeTextarea();
          const errMsg = data.error?.exception?.message || data.error?.message || data.error?.error || 'Falha na requisição';
          showToast(`Erro ao enviar arquivo: ${errMsg}`, 'error');
        }
      } else {
        const payload = {
          chatId: activeChat.id,
          text
        };
        if (currentReplyMsg) {
          payload.replyTo = getMsgId(currentReplyMsg);
        }

        const res = await fetch('/api/send-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.success) {
          activeChat.lastMessagePreview = text;
          activeChat.lastMessageFromMe = true;
          activeChat.lastActivity = Math.floor(Date.now() / 1000);

          await loadMessages(activeChat.id, true);
        } else {
          // Restaura texto original se falhar
          messageTextInput.value = originalText;
          if (currentReplyMsg) setReplyMessage(currentReplyMsg);
          autoResizeTextarea();
          const errMsg = data.error?.exception?.message || data.error?.message || data.error?.error || 'Falha no envio';
          showToast(`Erro ao enviar mensagem: ${errMsg}`, 'error');
        }
      }
    } catch (err) {
      console.error('Erro ao enviar:', err);
      messageTextInput.value = originalText;
      if (currentReplyMsg) setReplyMessage(currentReplyMsg);
      autoResizeTextarea();
      showToast('Erro de rede ao enviar mensagem', 'error');
    } finally {
      isSendingMessage = false;
      sendMsgBtn.disabled = false;
      messageTextInput.disabled = false;
      messageTextInput.focus();
    }
  }

  // ---------------------------------------------------------------------------
  // EVENT LISTENERS E INTERAÇÕES
  // ---------------------------------------------------------------------------
  function setupEventListeners() {
    if (cancelReplyBtn) {
      cancelReplyBtn.addEventListener('click', clearReplyMessage);
    }
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      handleSearch();
    });

    messageTextInput.addEventListener('input', autoResizeTextarea);
    messageTextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

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

    const closeViewerBtn = document.getElementById('close-viewer-btn');
    const fileViewerModal = document.getElementById('file-viewer-modal');
    if (closeViewerBtn) closeViewerBtn.addEventListener('click', window.closeFileViewer);
    if (fileViewerModal) {
      fileViewerModal.addEventListener('click', (e) => {
        if (e.target === fileViewerModal) window.closeFileViewer();
      });
    }

    sendMsgBtn.addEventListener('click', sendMessage);

    chatsListEl.addEventListener('scroll', () => {
      if (chatsListEl.scrollTop + chatsListEl.clientHeight >= chatsListEl.scrollHeight - 50) {
        loadMoreChats();
      }
    });

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
  }

  function handleSearch() {
    const query = searchInput.value.trim();
    if (query) {
      clearSearchBtn.classList.remove('hidden');
      activeFilterTagEl.style.display = 'inline-block';
      renderChatsList(filterChatsLocally(query));
    } else {
      clearSearchBtn.classList.add('hidden');
      activeFilterTagEl.style.display = 'none';
      renderChatsList(chats);
    }
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
