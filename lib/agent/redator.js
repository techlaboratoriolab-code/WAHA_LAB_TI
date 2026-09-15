const { GoogleGenAI, Type } = require('@google/genai');
const { montarConteudoDaConversa } = require('./gemini');

const SCHEMA_RESPOSTA = {
  type: Type.OBJECT,
  properties: {
    texto: { type: Type.STRING, description: 'A mensagem pronta para o atendente enviar. Vazio se não houver dado seguro suficiente.' }
  },
  required: ['texto']
};

const SYSTEM_INSTRUCTION = `Você ajuda um atendente de laboratório a responder pacientes no WhatsApp.
Você recebe: (1) fatos confirmados no sistema do laboratório — a ÚNICA fonte de verdade; (2) uma mensagem de referência já aprovada pelo laboratório, só como exemplo de tom e estrutura — sua resposta NÃO precisa ser parecida com ela, só manter o mesmo padrão de cordialidade e clareza; (3) quando houver, o histórico recente da conversa, para ajustar o tom ao que o paciente perguntou.

Regras rígidas:
- Escreva em português, curto e objetivo, adequado a uma mensagem de WhatsApp.
- Use SOMENTE os fatos fornecidos. Nunca invente exame, data, protocolo, convênio, valor ou status que não estejam nos fatos.
- Nunca interprete resultado de exame nem dê orientação clínica.
- Nunca se apresente por nome nem assine a mensagem — o sistema já identifica quem está enviando.
- Se os fatos fornecidos não permitirem responder com segurança sobre o que foi perguntado, devolva "texto" vazio em vez de arriscar.`;

// Só o que a mensagem precisa para ser factualmente correta — nunca o nome,
// CPF ou código do paciente, que o modelo não precisa ver para redigir.
function montarFatosParaModelo(situacao) {
  const fatos = {};
  for (const campo of ['exame', 'dtaPrevista', 'statusCliente']) {
    const v = situacao && situacao[campo];
    if (v !== null && v !== undefined && v !== '') fatos[campo] = v;
  }
  return fatos;
}

function sanitizarRedacao(bruto) {
  if (!bruto || typeof bruto !== 'object' || typeof bruto.texto !== 'string') return null;
  const texto = bruto.texto.trim();
  return texto ? { texto } : null;
}

function montarPrompt({ fatos, referencia, mensagens }) {
  const contextoConversa = montarConteudoDaConversa(mensagens || []);
  let prompt = `Fatos confirmados no sistema:\n${JSON.stringify(fatos)}\n\n`;
  prompt += `Mensagem de referência (tom e estrutura, não copiar literalmente):\n"""${referencia}"""\n`;
  if (contextoConversa) {
    prompt += `\nTrecho recente da conversa com o paciente:\n${contextoConversa}\n`;
  }
  prompt += '\nEscreva a mensagem para o atendente enviar.';
  return prompt;
}

// Falha do modelo nunca deve travar o painel: qualquer erro (rede, timeout,
// resposta inválida) resolve para null, e quem chamou trata como "sem sugestão".
function criarRedator({ apiKey, model, timeoutMs = 8000 }) {
  const ai = new GoogleGenAI({ apiKey });

  async function redigir({ situacao, referencia, mensagens }) {
    const fatos = montarFatosParaModelo(situacao);
    if (Object.keys(fatos).length === 0) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await ai.models.generateContent({
        model,
        contents: montarPrompt({ fatos, referencia, mensagens }),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA_RESPOSTA,
          temperature: 0.4,
          abortSignal: controller.signal
        }
      });
      return sanitizarRedacao(JSON.parse(response.text));
    } catch (err) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return { redigir };
}

module.exports = { criarRedator, montarFatosParaModelo, sanitizarRedacao };
