// Catálogo declarativo: adicionar um processo é acrescentar um registro aqui,
// nunca escrever código de integração novo.
//
// A busca dos três processos do MVP é 100% declarativa. A renderização é
// função de propósito — ela pede ao redator (lib/agent/redator.js) uma
// mensagem baseada no contexto real da conversa, oferecendo o pool inteiro
// de Respostas Rápidas de referência (não uma fixa por processo: é o próprio
// redator quem escolhe, a cada chamada, qual referência melhor se encaixa no
// que está sendo perguntado). Só cai no template fixo (o mecanismo original,
// ainda testado e funcional) se o redator não estiver configurado ou falhar.
// Isso mantém a garantia de sempre haver uma sugestão quando o dado existe,
// com ou sem LLM.
const { renderizarDeclarativo } = require('./motor');
const { REFERENCIAS_RESPOSTA_RAPIDA } = require('./referencias_respostas_rapidas');
const AGENT_TEMPLATES = require('../../public/agent_templates.js');

const POOL_REFERENCIAS = Object.entries(REFERENCIAS_RESPOSTA_RAPIDA).map(([id, r]) => ({ id, texto: r.texto }));

function criarRenderizador({ templateId, slots }) {
  return async function renderizar(situacao, contexto, apoio) {
    if (apoio && typeof apoio.redigir === 'function') {
      const redigido = await apoio.redigir({
        situacao,
        referencias: POOL_REFERENCIAS,
        mensagens: contexto && contexto.mensagens
      });
      if (redigido && redigido.texto) {
        return { templateId: `${templateId}:llm`, texto: redigido.texto, baseadoEm: redigido.baseadoEmId || null };
      }
    }

    const declarativo = renderizarDeclarativo({ templateId, slots }, situacao, AGENT_TEMPLATES);
    return declarativo.sugestao || { lacunas: declarativo.lacunas };
  };
}

const CATALOGO_PROCESSOS = [
  {
    id: 'previsao_entrega',
    intencao: 'previsao_entrega',
    buscar: { tipo: 'consultarPaciente' },
    renderizar: criarRenderizador({
      templateId: 'previsao_entrega',
      slots: { exame: 'situacao.exame', dtaPrevista: 'situacao.dtaPrevista' }
    })
  },
  {
    id: 'status_exame',
    intencao: 'status_exame',
    buscar: { tipo: 'consultarPaciente' },
    renderizar: criarRenderizador({
      templateId: 'status_exame',
      slots: { exame: 'situacao.exame', statusCliente: 'situacao.statusCliente' }
    })
  },
  {
    id: 'laudo_disponivel',
    intencao: 'laudo_disponivel',
    buscar: { tipo: 'consultarPaciente' },
    renderizar: criarRenderizador({
      templateId: 'laudo_disponivel',
      slots: { exame: 'situacao.exame', statusCliente: 'situacao.statusCliente' }
    })
  }
];

module.exports = { CATALOGO_PROCESSOS };
