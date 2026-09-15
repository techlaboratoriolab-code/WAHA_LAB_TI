const { executarProcesso } = require('./motor');
const { CATALOGO_PROCESSOS } = require('./catalogo');
const AGENT_TEMPLATES = require('../../public/agent_templates.js');

// A situação já foi obtida (por código ou por paciente já desambiguado); aqui
// só se decide QUAIS respostas prontas ela sustenta, reaproveitando o mesmo
// motor e a mesma checagem de lacunas usada no fluxo com identificador.
async function calcularSugestoes(situacao) {
  const ferramentas = { consultarPaciente: async () => ({ encontrado: true, multiplos: false, situacao }) };
  const contexto = { identificadores: { codRequisicao: situacao.codRequisicao || 'presente' } };

  const sugestoes = [];
  for (const processo of CATALOGO_PROCESSOS) {
    const r = await executarProcesso(processo, contexto, ferramentas, AGENT_TEMPLATES);
    if (r.resultado === 'sugestao') {
      sugestoes.push({ processoId: processo.id, intencao: processo.intencao, templateId: r.sugestao.templateId, texto: r.sugestao.texto });
    }
  }
  return sugestoes;
}

module.exports = { calcularSugestoes };
