const { GoogleGenAI, Type } = require('@google/genai');

// Lista fechada: nunca aceitar rótulo livre do modelo. "outro" é o campo de
// descoberta — vira log estruturado para priorizar o próximo processo a mapear.
const INTENCOES = ['previsao_entrega', 'laudo_disponivel', 'status_exame', 'orientacao_preparo', 'situacao_pagamento', 'outro'];

const SCHEMA_RESPOSTA = {
  type: Type.OBJECT,
  properties: {
    intencao: { type: Type.STRING, enum: INTENCOES },
    confianca: { type: Type.NUMBER, description: 'De 0 a 1, quão claro está o pedido do paciente.' },
    nome: { type: Type.STRING, description: 'Nome do paciente, só se ele mesmo se identificou na conversa. Vazio se não.' },
    resumoLivre: { type: Type.STRING, description: 'Só quando intencao="outro": resumo curto do que o paciente pediu, sem dado sensível.' }
  },
  required: ['intencao', 'confianca', 'nome', 'resumoLivre'],
  propertyOrdering: ['intencao', 'confianca', 'nome', 'resumoLivre']
};

const SYSTEM_INSTRUCTION = `Você apoia atendentes de um laboratório de análises clínicas que conversam com pacientes pelo WhatsApp.
Sua única tarefa é classificar a intenção da ÚLTIMA mensagem do paciente, usando o histórico como contexto.

Intenções possíveis:
- previsao_entrega: o paciente quer saber quando o resultado/exame vai ficar pronto.
- laudo_disponivel: o paciente quer saber se o laudo já está disponível ou pede o laudo.
- status_exame: o paciente pergunta em que etapa o exame está (coleta, análise, etc.), sem ser especificamente sobre prazo ou laudo pronto.
- orientacao_preparo: o paciente pergunta como se preparar para um exame (jejum, hidratação, coleta de urina etc.) ANTES de realizá-lo — não é sobre um exame já em andamento ou já coletado.
- situacao_pagamento: o paciente pergunta se o exame JÁ REALIZADO foi cortesia, particular ou por qual convênio foi cobrado — confirmação sobre como o exame que ele já fez foi pago, não uma dúvida de orçamento para um exame novo.
- outro: qualquer outro assunto (dúvida de orçamento para exame novo, dúvida geral, saudação, etc.).

Regras rígidas:
- Nunca invente CPF, nome ou código de requisição que não estejam explicitamente na conversa.
- Nunca interprete resultado de exame nem dê orientação clínica.
- "nome" só deve ser preenchido se o próprio paciente disse seu nome nesta conversa; senão deixe vazio.
- "resumoLivre" só é usado quando intencao="outro": um resumo de poucas palavras, sem CPF/nome/telefone.
- confianca reflete o quão inequívoca é a intenção; mensagens vagas ou fora de contexto devem ter confianca baixa.`;

function paraNumero01(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function paraTextoOuNulo(valor) {
  const t = typeof valor === 'string' ? valor.trim() : '';
  return t || null;
}

// Nunca confia cegamente na saída do modelo: intenção fora do enum vira
// "outro" com confiança zero, e campos ausentes/vazios viram null (nunca "").
function sanitizarClassificacao(bruto) {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) {
    return { intencao: 'outro', confianca: 0, nome: null, resumoLivre: null };
  }
  const intencaoValida = INTENCOES.includes(bruto.intencao);
  return {
    intencao: intencaoValida ? bruto.intencao : 'outro',
    confianca: intencaoValida ? paraNumero01(bruto.confianca) : 0,
    nome: paraTextoOuNulo(bruto.nome),
    resumoLivre: paraTextoOuNulo(bruto.resumoLivre)
  };
}

function montarConteudoDaConversa(mensagens) {
  return (mensagens || [])
    .filter((m) => m && typeof m.body === 'string' && m.body.trim())
    .map((m) => `${m.fromMe ? 'Atendente' : 'Paciente'}: ${m.body.trim()}`)
    .join('\n');
}

function criarClassificadorIntencao({ apiKey, model, timeoutMs = 8000 }) {
  const ai = new GoogleGenAI({ apiKey });

  async function classificar(mensagens) {
    const conteudo = montarConteudoDaConversa(mensagens);
    if (!conteudo) return sanitizarClassificacao(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await ai.models.generateContent({
        model,
        contents: conteudo,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA_RESPOSTA,
          temperature: 0,
          abortSignal: controller.signal
        }
      });
      const bruto = JSON.parse(response.text);
      return sanitizarClassificacao(bruto);
    } finally {
      clearTimeout(timer);
    }
  }

  return { classificar };
}

module.exports = { criarClassificadorIntencao, sanitizarClassificacao, montarConteudoDaConversa, INTENCOES };
