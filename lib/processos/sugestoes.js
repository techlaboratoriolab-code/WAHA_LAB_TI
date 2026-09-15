const { executarProcesso } = require('./motor');
const { CATALOGO_PROCESSOS } = require('./catalogo');

// A situação já foi obtida (por código ou por paciente já desambiguado); aqui
// só se decide QUAIS respostas prontas ela sustenta. `redator` e `mensagens`
// são opcionais: sem eles, cada processo cai no seu template fixo (ver
// lib/processos/catalogo.js) — a suíte de testes original, sem LLM, continua
// valendo como o caminho de segurança quando o modelo está indisponível.
async function calcularSugestoes(situacao, { redator, mensagens } = {}) {
  const ferramentas = { consultarPaciente: async () => ({ encontrado: true, multiplos: false, situacao }) };
  const contexto = { identificadores: { codRequisicao: situacao.codRequisicao || 'presente' }, mensagens };
  const apoio = redator ? { redigir: (args) => redator.redigir(args) } : {};

  // Um processo independe do outro — roda em paralelo para não empilhar a
  // latência de cada chamada ao redator (~1s cada, ~3s se fosse em série).
  const resultados = await Promise.all(
    CATALOGO_PROCESSOS.map((processo) => executarProcesso(processo, contexto, ferramentas, {}, apoio))
  );

  return resultados
    .map((r, i) => ({ processo: CATALOGO_PROCESSOS[i], r }))
    .filter(({ r }) => r.resultado === 'sugestao')
    .map(({ processo, r }) => ({
      processoId: processo.id,
      intencao: processo.intencao,
      templateId: r.sugestao.templateId,
      texto: r.sugestao.texto,
      baseadoEm: r.sugestao.baseadoEm || null
    }));
}

module.exports = { calcularSugestoes };
