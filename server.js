require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do WAHA
const WAHA_CONFIG = {
  url: process.env.WAHA_URL || 'https://waha.ngrok.dev',
  session: process.env.WAHA_SESSION || 'atendimento',
  apiKey: process.env.WAHA_API_KEY || 'laboratorio-lab',
  user: process.env.WAHA_USER || 'LAB',
  password: process.env.WAHA_PASSWORD || 'lab0042'
};

// Autenticação Basic Auth Base64
const authStr = `${WAHA_CONFIG.user}:${WAHA_CONFIG.password}`;
const b64Auth = Buffer.from(authStr).toString('base64');

// Headers padrão para requisições ao WAHA
function getWahaHeaders() {
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
    try { client.write(payload); } catch(e) {}
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
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getWahaHeaders()
    });
    
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }
    const chats = await response.json();

    // Enriquecer em paralelo com a preview da última mensagem
    const enrichedChats = await Promise.all(chats.map(async (chat) => {
      try {
        const encodedId = encodeURIComponent(chat.id);
        const msgRes = await fetch(`${WAHA_CONFIG.url}/api/${WAHA_CONFIG.session}/chats/${encodedId}/messages?limit=1`, {
          method: 'GET',
          headers: getWahaHeaders()
        });
        if (msgRes.ok) {
          const msgs = await msgRes.json();
          if (Array.isArray(msgs) && msgs.length > 0) {
            const { preview, fromMe, timestamp } = extractMessagePreview(msgs[0]);
            chat.lastMessagePreview = preview;
            chat.lastMessageFromMe = fromMe;
            if (timestamp) {
              chat.lastActivity = timestamp;
            }
          }
        }
      } catch (e) {
        // Falha individual na preview não bloqueia o chat
      }
      return chat;
    }));

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

// 5. Enviar mensagem de texto
app.post('/api/send-text', async (req, res) => {
  try {
    const { chatId, text } = req.body;
    if (!chatId || !text) {
      return res.status(400).json({ error: 'chatId e text são obrigatórios' });
    }

    const payload = {
      session: WAHA_CONFIG.session,
      chatId,
      text
    };

    const response = await fetch(`${WAHA_CONFIG.url}/api/sendText`, {
      method: 'POST',
      headers: getWahaHeaders(),
      body: JSON.stringify(payload)
    });

    const resultText = await response.text();
    let resultJson;
    try { resultJson = JSON.parse(resultText); } catch(e) { resultJson = { raw: resultText }; }

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
    const { chatId, caption } = req.body;
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

    const response = await fetch(`${WAHA_CONFIG.url}/api/sendFile`, {
      method: 'POST',
      headers: getWahaHeaders(),
      body: JSON.stringify(payload)
    });

    const resultText = await response.text();
    let resultJson;
    try { resultJson = JSON.parse(resultText); } catch(e) { resultJson = { raw: resultText }; }

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
    try { resultJson = JSON.parse(resultText); } catch(e) { resultJson = { raw: resultText }; }

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

// Iniciar servidor
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
