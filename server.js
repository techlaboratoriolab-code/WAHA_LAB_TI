require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do WAHA
const WAHA_CONFIG = {
  get url() {
    let raw = process.env.WAHA_URL || 'https://waha.ngrok.dev';
    raw = raw.trim().replace(/\/+$/, '');
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = `https://${raw}`;
    }
    return raw;
  },
  get session() {
    return (process.env.WAHA_SESSION || 'atendimento').trim();
  },
  get apiKey() {
    return (process.env.WAHA_API_KEY || 'laboratorio-lab').trim();
  },
  get user() {
    return (process.env.WAHA_USER || 'LAB').trim();
  },
  get password() {
    return (process.env.WAHA_PASSWORD || 'lab0042').trim();
  }
};

// Headers padrão para requisições ao WAHA
function getWahaHeaders() {
  const authStr = `${WAHA_CONFIG.user}:${WAHA_CONFIG.password}`;
  const b64Auth = Buffer.from(authStr).toString('base64');
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': WAHA_CONFIG.apiKey,
    'Authorization': `Basic ${b64Auth}`,
    'ngrok-skip-browser-warning': 'true'
  };
}

// Configuração de upload de arquivos (Multer na memória)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir frontend estático
app.use(express.static(path.join(__dirname, 'public')));

const { createClient } = require('@supabase/supabase-js');

// Cliente Supabase no Servidor (Proxy Backend)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
let supabaseServer = null;

if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('seu-projeto')) {
  supabaseServer = createClient(supabaseUrl, supabaseAnonKey);
}

// -----------------------------------------------------------------------------
// ENDPOINTS DE AUTENTICAÇÃO FLOW LAB (BACKEND PROXY)
// -----------------------------------------------------------------------------

// 1. POST /api/auth/login — Autentica e consulta o perfil (Read-Only) no servidor
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    if (!supabaseServer) {
      return res.status(500).json({ error: 'Supabase não configurado no .env do servidor.' });
    }

    // Autenticação no Supabase via Servidor
    const { data, error } = await supabaseServer.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      let userFriendlyMsg = error.message;
      if (error.message.includes('Invalid login credentials')) {
        userFriendlyMsg = 'E-mail ou senha incorretos. Verifique suas credenciais.';
      } else if (error.message.includes('Email not confirmed')) {
        userFriendlyMsg = 'Confirme seu e-mail antes de fazer login.';
      }
      return res.status(401).json({ error: userFriendlyMsg });
    }

    const user = data.user;

    // Consulta estrita (Read-Only) do perfil na tabela user_profiles
    const { data: profileData, error: profileErr } = await supabaseServer
      .from('user_profiles')
      .select('*, custom_roles(id, name, permissions)')
      .eq('id', user.id)
      .single();

    if (profileErr && profileErr.code !== 'PGRST116') {
      console.error('Erro ao consultar perfil:', profileErr.message);
    }

    let permissions = [];
    let role = 'requester';
    let department = 'Não informado';
    let name = user.user_metadata?.name || email.split('@')[0] || 'Usuário';

    if (profileData) {
      role = profileData.role || 'requester';
      department = profileData.department || department;
      name = profileData.name || name;

      if (profileData.custom_roles && Array.isArray(profileData.custom_roles.permissions)) {
        permissions = profileData.custom_roles.permissions;
      }
    }

    // Avaliação da permissão canUseWhatsapp
    const isAdmin = role === 'admin' || permissions.includes('*') || permissions.includes('all');
    const hasWhatsappAccess = isAdmin || permissions.includes('canUseWhatsapp');

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name,
        role,
        department,
        permissions
      },
      session: {
        accessToken: data.session?.access_token
      },
      hasWhatsappAccess
    });
  } catch (err) {
    console.error('Erro no login backend:', err.message);
    return res.status(500).json({ error: 'Erro interno ao realizar autenticação.' });
  }
});

// 2. POST /api/auth/forgot-password — Redefinição de Senha
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Insira seu e-mail para recuperar a senha.' });
    }

    if (!supabaseServer) {
      return res.status(500).json({ error: 'Supabase não configurado no .env.' });
    }

    const { error } = await supabaseServer.auth.resetPasswordForEmail(email, {
      redirectTo: `${req.protocol}://${req.get('host')}/reset-password`
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ success: true, message: 'Instruções de redefinição de senha enviadas.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao solicitar redefinição de senha.' });
  }
});

// 3. POST /api/auth/verify-session — Validação de Sessão Salva
app.post('/api/auth/verify-session', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId || !supabaseServer) {
      return res.status(401).json({ authenticated: false });
    }

    const { data: profileData, error: profileErr } = await supabaseServer
      .from('user_profiles')
      .select('*, custom_roles(id, name, permissions)')
      .eq('id', userId)
      .single();

    if (profileErr || !profileData) {
      return res.status(401).json({ authenticated: false });
    }

    let permissions = [];
    if (profileData.custom_roles && Array.isArray(profileData.custom_roles.permissions)) {
      permissions = profileData.custom_roles.permissions;
    }

    const isAdmin = profileData.role === 'admin' || permissions.includes('*') || permissions.includes('all');
    const hasWhatsappAccess = isAdmin || permissions.includes('canUseWhatsapp');

    return res.json({
      authenticated: true,
      user: {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        role: profileData.role,
        department: profileData.department,
        permissions
      },
      hasWhatsappAccess
    });
  } catch (err) {
    return res.status(401).json({ authenticated: false });
  }
});



// Helper para extrair preview legível de mensagem
function extractMessagePreview(msg) {
  if (!msg) return { preview: '', fromMe: false, timestamp: null };
  let preview = msg.body || '';
  if (msg.hasMedia || msg.type === 'document' || msg.type === 'image' || msg.type === 'ptt' || msg.type === 'audio' || msg.type === 'video' || msg.type === 'sticker') {
    if (msg.type === 'document') preview = '📄 Documento PDF';
    else if (msg.type === 'image') preview = '📷 Foto';
    else if (msg.type === 'ptt' || msg.type === 'audio') preview = '🎵 Áudio';
    else if (msg.type === 'video') preview = '🎥 Vídeo';
    else preview = '📎 Arquivo de mídia';
    if (msg.caption) preview += `: ${msg.caption}`;
  }
  return {
    preview,
    fromMe: msg.fromMe === true,
    timestamp: msg.timestamp || null
  };
}

// Clients SSE (Server-Sent Events) para Tempo Real no Frontend
let sseClients = [];

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

function broadcastEvent(eventType, data) {
  const payload = `data: ${JSON.stringify({ event: eventType, data })}\n\n`;
  sseClients.forEach(client => {
    try { client.write(payload); } catch (e) { }
  });
}

// -----------------------------------------------------------------------------
// ENDPOINTS DA API (PROXIES E REAL-TIME PARA O WAHA)
// -----------------------------------------------------------------------------

// Webhook para receber notificações do WAHA em tempo real
app.post('/api/webhook', (req, res) => {
  try {
    const { event, session, payload } = req.body || {};
    if (payload) {
      const chatId = payload.fromMe ? payload.to : payload.from;
      const { preview, fromMe, timestamp } = extractMessagePreview(payload);

      broadcastEvent('message', {
        chatId,
        message: payload,
        preview,
        fromMe,
        timestamp: timestamp || Math.floor(Date.now() / 1000)
      });
    }
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Erro no webhook:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 1. Obter status da sessão
app.get('/api/session-status', async (req, res) => {
  try {
    const response = await fetch(`${WAHA_CONFIG.url}/api/sessions`, {
      method: 'GET',
      headers: getWahaHeaders()
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Erro ao consultar sessões' });
    }
    const sessions = await response.json();
    const currentSession = sessions.find(s => s.name === WAHA_CONFIG.session) || { name: WAHA_CONFIG.session, status: 'UNKNOWN' };
    res.json({ session: currentSession, allSessions: sessions });
  } catch (err) {
    console.error('Erro session-status:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2. Reiniciar sessão se ficar travada
app.post('/api/restart-session', async (req, res) => {
  try {
    const response = await fetch(`${WAHA_CONFIG.url}/api/sessions/${WAHA_CONFIG.session}/restart`, {
      method: 'POST',
      headers: getWahaHeaders()
    });
    const data = await response.json();
    res.json({ success: response.ok, data });
  } catch (err) {
    console.error('Erro restart-session:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. Obter lista de chats com PREVIEW E PAGINAÇÃO ORDENADA POR RECENTE
app.get('/api/chats', async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;
    const sortBy = req.query.sortBy || 'conversationTimestamp';
    const sortOrder = req.query.sortOrder || 'desc';

    const url = `${WAHA_CONFIG.url}/api/${WAHA_CONFIG.session}/chats?limit=${limit}&offset=${offset}&sortBy=${sortBy}&sortOrder=${sortOrder}`;

    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: getWahaHeaders()
      });
    } catch (fetchErr) {
      console.error('Erro de conexão ao buscar chats no WAHA:', fetchErr.message);
      return res.status(502).json({ error: 'Não foi possível conectar ao servidor WAHA.' });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Erro na resposta do WAHA');
      return res.status(response.status).json({ error: errText });
    }

    const chatsData = await response.json().catch(() => []);
    const chats = Array.isArray(chatsData) ? chatsData : [];

    if (chats.length === 0) {
      return res.json([]);
    }

    // Processamento em lotes de 10 requisições simultâneas para evitar estourar o ngrok
    const BATCH_SIZE = 10;
    const enrichedChats = [];

    for (let i = 0; i < chats.length; i += BATCH_SIZE) {
      const batch = chats.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (chat) => {
        if (!chat || !chat.id) return chat;
        try {
          if (chat.lastMessage) {
            const { preview, fromMe, timestamp } = extractMessagePreview(chat.lastMessage);
            chat.lastMessagePreview = preview;
            chat.lastMessageFromMe = fromMe;
            if (timestamp) chat.lastActivity = timestamp;
            return chat;
          }

          const encodedId = encodeURIComponent(chat.id);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);

          const msgRes = await fetch(`${WAHA_CONFIG.url}/api/${WAHA_CONFIG.session}/chats/${encodedId}/messages?limit=1`, {
            method: 'GET',
            headers: getWahaHeaders(),
            signal: controller.signal
          }).catch(() => null);

          clearTimeout(timeoutId);

          if (msgRes && msgRes.ok) {
            const msgs = await msgRes.json().catch(() => []);
            if (Array.isArray(msgs) && msgs.length > 0) {
              const { preview, fromMe, timestamp } = extractMessagePreview(msgs[0]);
              chat.lastMessagePreview = preview;
              chat.lastMessageFromMe = fromMe;
              if (timestamp) chat.lastActivity = timestamp;
            }
          }
        } catch (e) {
          // Ignora falhas individuais em previews
        }
        return chat;
      }));

      enrichedChats.push(...batchResults);
    }

    res.json(enrichedChats);
  } catch (err) {
    console.error('Erro /api/chats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 4. Obter mensagens de um chat específico
app.get('/api/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const limit = req.query.limit || 50;
    const encodedChatId = encodeURIComponent(chatId);

    let url = `${WAHA_CONFIG.url}/api/${WAHA_CONFIG.session}/chats/${encodedChatId}/messages?limit=${limit}`;
    let response = await fetch(url, {
      method: 'GET',
      headers: getWahaHeaders()
    });

    if (!response.ok) {
      url = `${WAHA_CONFIG.url}/api/messages?session=${WAHA_CONFIG.session}&chatId=${encodedChatId}&limit=${limit}`;
      response = await fetch(url, {
        method: 'GET',
        headers: getWahaHeaders()
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const messages = await response.json();
    res.json(messages);
  } catch (err) {
    console.error('Erro /api/chats/:chatId/messages:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Cache em memória para prevenção de envio duplicado (Deduplicação de Requisições)
const recentSendsCache = new Map();

function isDuplicateSendRequest(chatId, text) {
  if (!chatId || !text) return false;
  const key = `${chatId}:${text}`;
  const now = Date.now();
  const lastTime = recentSendsCache.get(key);

  if (recentSendsCache.size > 200) {
    for (const [k, v] of recentSendsCache.entries()) {
      if (now - v > 10000) recentSendsCache.delete(k);
    }
  }

  if (lastTime && (now - lastTime < 3000)) {
    return true;
  }
  recentSendsCache.set(key, now);
  return false;
}

// 5. Enviar mensagem de texto
app.post('/api/send-text', async (req, res) => {
  try {
    const { chatId, text, replyTo, reply_to } = req.body;
    if (!chatId || !text) {
      return res.status(400).json({ error: 'chatId e text são obrigatórios' });
    }

    if (isDuplicateSendRequest(chatId, text)) {
      console.warn(`[DEDUPLICAÇÃO] Requisição duplicada ignorada para o chat ${chatId}: "${text}"`);
      return res.json({ success: true, duplicated: true });
    }

    const payload = {
      session: WAHA_CONFIG.session,
      chatId,
      text
    };

    const targetReplyTo = replyTo || reply_to;
    if (targetReplyTo) {
      payload.reply_to = targetReplyTo;
    }

    const response = await fetch(`${WAHA_CONFIG.url}/api/sendText`, {
      method: 'POST',
      headers: getWahaHeaders(),
      body: JSON.stringify(payload)
    });

    const resultText = await response.text();
    let resultJson;
    try { resultJson = JSON.parse(resultText); } catch (e) { resultJson = { raw: resultText }; }

    if (response.ok) {
      broadcastEvent('message', {
        chatId,
        message: resultJson,
        preview: text,
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000)
      });
      res.json({ success: true, data: resultJson });
    } else {
      const errStr = JSON.stringify(resultJson);
      if (errStr.includes('server returned error 400') || errStr.includes('gows')) {
        console.warn(`[WAHA RECOVERY] Detectada falha no gRPC do WAHA. Solicitando reinício automático da sessão "${WAHA_CONFIG.session}"...`);
        fetch(`${WAHA_CONFIG.url}/api/sessions/${WAHA_CONFIG.session}/restart`, {
          method: 'POST',
          headers: getWahaHeaders()
        }).catch(e => console.error('Erro no auto-restart:', e.message));
      }
      res.status(response.status).json({ success: false, error: resultJson, statusCode: response.status });
    }
  } catch (err) {
    console.error('Erro /api/send-text:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 6. Enviar arquivo / PDF / Mídia
app.post('/api/send-file', upload.single('file'), async (req, res) => {
  try {
    const { chatId, caption, replyTo, reply_to } = req.body;
    if (!chatId || !req.file) {
      return res.status(400).json({ error: 'chatId e arquivo são obrigatórios' });
    }

    const fileBase64 = req.file.buffer.toString('base64');
    const mimetype = req.file.mimetype || 'application/octet-stream';
    const filename = req.file.originalname || 'documento.pdf';

    const payload = {
      session: WAHA_CONFIG.session,
      chatId,
      file: {
        mimetype,
        filename,
        data: fileBase64
      }
    };

    if (caption) {
      payload.caption = caption;
    }

    const targetReplyTo = replyTo || reply_to;
    if (targetReplyTo) {
      payload.reply_to = targetReplyTo;
    }

    const response = await fetch(`${WAHA_CONFIG.url}/api/sendFile`, {
      method: 'POST',
      headers: getWahaHeaders(),
      body: JSON.stringify(payload)
    });

    const resultText = await response.text();
    let resultJson;
    try { resultJson = JSON.parse(resultText); } catch (e) { resultJson = { raw: resultText }; }

    if (response.ok) {
      const filePreview = mimetype.includes('pdf') ? `📄 ${filename}` : `📎 ${filename}`;
      broadcastEvent('message', {
        chatId,
        message: resultJson,
        preview: caption ? `${filePreview}: ${caption}` : filePreview,
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000)
      });
      res.json({ success: true, data: resultJson });
    } else {
      res.status(response.status).json({ success: false, error: resultJson, statusCode: response.status });
    }
  } catch (err) {
    console.error('Erro /api/send-file:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 7. Enviar status de visualizado (Send Seen / Mark Read)
app.post('/api/send-seen', async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) {
      return res.status(400).json({ error: 'chatId é obrigatório' });
    }

    const payload = {
      session: WAHA_CONFIG.session,
      chatId
    };

    const response = await fetch(`${WAHA_CONFIG.url}/api/sendSeen`, {
      method: 'POST',
      headers: getWahaHeaders(),
      body: JSON.stringify(payload)
    });

    const resultText = await response.text();
    let resultJson;
    try { resultJson = JSON.parse(resultText); } catch (e) { resultJson = { raw: resultText }; }

    res.json({ success: response.ok, data: resultJson });
  } catch (err) {
    console.error('Erro /api/send-seen:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 8. Proxy de arquivos e mídias do WAHA (Imagens, PDFs, Áudios, Documentos)
app.get('/api/files/*', async (req, res) => {
  try {
    const fileRelPath = req.params[0];
    const wahaMediaUrl = `${WAHA_CONFIG.url}/api/files/${fileRelPath}`;

    const mediaRes = await fetch(wahaMediaUrl, {
      headers: getWahaHeaders()
    });

    if (!mediaRes.ok) {
      // Tentar rota alternativa sem /files/ no WAHA
      const altUrl = `${WAHA_CONFIG.url}/api/${WAHA_CONFIG.session}/files/${fileRelPath}`;
      const altRes = await fetch(altUrl, { headers: getWahaHeaders() });
      if (altRes.ok) {
        const ct = altRes.headers.get('content-type');
        if (ct) res.setHeader('Content-Type', ct);
        const buf = await altRes.arrayBuffer();
        return res.send(Buffer.from(buf));
      }
      return res.status(mediaRes.status).send('Mídia não encontrada no WAHA.');
    }

    const contentType = mediaRes.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    const arrayBuffer = await mediaRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Erro proxy media file:', err.message);
    res.status(500).send('Erro ao carregar arquivo de mídia.');
  }
});

// Iniciar servidor (Local ou Vercel Serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
===========================================================
🚀 INTERFACE WHATSAPP WEB WAHA RODANDO COM REAL-TIME E PREVIEW!
===========================================================
📍 URL Local:         http://localhost:${PORT}
📍 WAHA Alvo:         ${WAHA_CONFIG.url}
📍 Sessão WAHA:       "${WAHA_CONFIG.session}"
📍 Endpoint Webhook:  http://localhost:${PORT}/api/webhook
===========================================================
    `);
  });
}

module.exports = app;
