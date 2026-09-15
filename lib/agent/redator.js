const { GoogleGenAI, Type } = require('@google/genai');
const { montarConteudoDaConversa } = require('./gemini');

const SCHEMA_RESPOSTA = {
  type: Type.OBJECT,
  properties: {
    texto: { type: Type.STRING, description: 'A mensagem pronta para o atendente enviar. Vazio se não houver dado seguro suficiente.' },
    baseadoEmId: { type: Type.STRING, description: 'O id, dentre as referências fornecidas, cujo tom e estrutura mais influenciaram esta mensagem. String vazia se nenhuma delas se encaixou bem.' }
  },
  required: ['texto']
};

const SYSTEM_INSTRUCTION = `Você ajuda um atendente de laboratório a responder pacientes no WhatsApp.
Você recebe: (1) fatos confirmados no sistema do laboratório — a ÚNICA fonte de verdade; (2) uma lista de mensagens de referência já aprovadas pelo laboratório, cada uma com um id — escolha mentalmente, pelo que a conversa real está pedindo, qual delas (se alguma) tem o tom e a estrutura mais adequados a este caso; sua resposta final NÃO precisa ser parecida com nenhuma delas ao pé da letra, só manter o mesmo padrão de cordialidade e clareza; (3) quando houver, o histórico recente da conversa, para ajustar o tom ao que o paciente perguntou.

Regras rígidas:
- Escreva em português, curto e objetivo, adequado a uma mensagem de WhatsApp.
- Use SOMENTE os fatos fornecidos. Nunca invente exame, data, protocolo, convênio, valor ou status que não estejam nos fatos.
- Nunca interprete resultado de exame nem dê orientação clínica.
- Nunca se apresente por nome nem assine a mensagem — o sistema já identifica quem está enviando.
- Se os fatos fornecidos não permitirem responder com segurança sobre o que foi perguntado, devolva "texto" vazio em vez de arriscar.
- Informe em "baseadoEmId" o id da referência que mais orientou o tom, ou string vazia se nenhuma se aplicou bem — nunca invente um id que não esteja na lista fornecida.`;

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

// `referencias`, quando fornecido, restringe quais ids de baseadoEmId são
// aceitos — um id fora da lista oferecida é descartado (o modelo alegando
// ter se baseado em algo que nunca recebeu é tratado como alucinação, não
// como dado confiável). Sem lista (ou lista vazia), nenhum baseadoEmId é
// aceito — mantém compatibilidade com quem chama só com {texto}.
function sanitizarRedacao(bruto, referencias) {
  if (!bruto || typeof bruto !== 'object' || typeof bruto.texto !== 'string') return null;
  const texto = bruto.texto.trim();
  if (!texto) return null;

  const resultado = { texto };
  const idsValidos = new Set((referencias || []).map((r) => r.id));
  if (typeof bruto.baseadoEmId === 'string' && idsValidos.has(bruto.baseadoEmId.trim())) {
    resultado.baseadoEmId = bruto.baseadoEmId.trim();
  }
  return resultado;
}

function montarPrompt({ fatos, referencias, mensagens }) {
  const contextoConversa = montarConteudoDaConversa(mensagens || []);
  let prompt = `Fatos confirmados no sistema:\n${JSON.stringify(fatos)}\n\n`;
  prompt += 'Mensagens de referência disponíveis (tom e estrutura; escolha a mais adequada ao contexto real, não copie nenhuma literalmente):\n';
  for (const ref of referencias || []) {
    prompt += `[${ref.id}] """${ref.texto}"""\n`;
  }
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

  async function redigir({ situacao, referencias, mensagens }) {
    const fatos = montarFatosParaModelo(situacao);
    if (Object.keys(fatos).length === 0) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await ai.models.generateContent({
        model,
        contents: montarPrompt({ fatos, referencias, mensagens }),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA_RESPOSTA,
          temperature: 0.4,
          abortSignal: controller.signal
        }
      });
      return sanitizarRedacao(JSON.parse(response.text), referencias);
    } catch (err) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return { redigir };
}

module.exports = { criarRedator, montarFatosParaModelo, sanitizarRedacao };
