// Catálogo declarativo: adicionar um processo é acrescentar um registro aqui,
// nunca escrever código de integração novo.
//
// A busca dos quatro processos é 100% declarativa. A renderização de três
// deles (previsao_entrega, status_exame, laudo_disponivel) é função de
// propósito — pede ao redator (lib/agent/redator.js) uma mensagem baseada no
// contexto real da conversa, oferecendo o pool inteiro de Respostas Rápidas
// de referência (não uma fixa por processo: é o próprio redator quem
// escolhe, a cada chamada, qual referência melhor se encaixa no que está
// sendo perguntado). Só cai no template fixo (o mecanismo original, ainda
// testado e funcional) se o redator não estiver configurado ou falhar. Isso
// mantém a garantia de sempre haver uma sugestão quando o dado existe, com
// ou sem LLM.
//
// O quarto (situacao_pagamento) fica de fora dessa escotilha de propósito:
// é uma confirmação factual (cortesia/convênio/particular), não uma redação
// de tom, e permanece 100% declarativo — ver o comentário junto ao registro.
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
  },
  // Único dos quatro que NÃO usa a escotilha do redator: `situacao.situacaoPagamento`
  // já chega pronta de fora do motor (server.js consulta o banco espelho,
  // fora do apLIS, e anexa antes de calcularSugestoes rodar — ver design.md,
  // "Cortesia/convênio: banco espelho, não a API"). É uma confirmação
  // factual, não uma redação de tom, então fica 100% declarativa.
  {
    id: 'situacao_pagamento',
    intencao: 'situacao_pagamento',
    buscar: { tipo: 'consultarPaciente' },
    renderizar: {
      templateId: 'situacao_pagamento',
      slots: { exame: 'situacao.exame', situacaoPagamento: 'situacao.situacaoPagamento' }
    }
  }
];

module.exports = { CATALOGO_PROCESSOS };
