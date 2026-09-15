// Motor de processos: todo processo — simples ou complexo — passa pelo mesmo
// ciclo (buscar -> renderizar), e cada etapa aceita declaração de dados ou
// função. As garantias (nunca falar com o apLIS direto, nunca pular a
// desambiguação) vêm de quem chama executarProcesso só poder oferecer
// `ferramentas.consultarPaciente` — nenhum processo recebe o cliente do apLIS.

function encontrarProcesso(catalogo, intencao) {
  return catalogo.find((p) => p.intencao === intencao) || null;
}

function resolverCaminho(raiz, caminho) {
  return String(caminho).split('.').reduce((acc, chave) => (acc == null ? acc : acc[chave]), raiz);
}

function temIdentificador(identificadores) {
  return !!(identificadores && (identificadores.codRequisicao || identificadores.cpf || identificadores.nome || identificadores.credencialPortal));
}

async function executarBusca(processo, contexto, ferramentas) {
  if (typeof processo.buscar === 'function') {
    return processo.buscar(contexto, ferramentas);
  }
  if (processo.buscar && processo.buscar.tipo === 'consultarPaciente') {
    return ferramentas.consultarPaciente(contexto.identificadores);
  }
  throw new Error(`Processo "${processo.id}" não declara uma busca válida.`);
}

function renderizarDeclarativo(spec, situacao, templates) {
  const template = templates[spec.templateId];
  if (!template) {
    throw new Error(`Template "${spec.templateId}" não encontrado.`);
  }

  const raiz = { situacao };
  const valores = {};
  for (const [slot, caminho] of Object.entries(spec.slots || {})) {
    valores[slot] = resolverCaminho(raiz, caminho);
  }

  const lacunas = (template.slotsObrigatorios || []).filter((slot) => {
    const v = valores[slot];
    return v === null || v === undefined || v === '';
  });
  if (lacunas.length > 0) {
    return { lacunas };
  }

  const texto = template.texto.replace(/\{\{(\w+)\}\}/g, (_, slot) => (valores[slot] != null ? valores[slot] : ''));
  return { sugestao: { templateId: spec.templateId, texto } };
}

async function executarRenderizacao(processo, situacao, contexto, templates) {
  if (typeof processo.renderizar === 'function') {
    return { sugestao: processo.renderizar(situacao, contexto) };
  }
  return renderizarDeclarativo(processo.renderizar, situacao, templates);
}

// contexto: { identificadores: { codRequisicao?, cpf?, nome?, credencialPortal? } }
// ferramentas: { consultarPaciente(identificadores) } — único acesso a dado externo
//   permitido a um processo; a implementação real (fora dos testes) já aplica a
//   desambiguação obrigatória e nunca expõe o cliente do apLIS.
async function executarProcesso(processo, contexto, ferramentas, templates = {}) {
  if (!temIdentificador(contexto.identificadores)) {
    return { resultado: 'requer_identificador', sugestao: null };
  }

  const dadosBusca = await executarBusca(processo, contexto, ferramentas);

  if (!dadosBusca || !dadosBusca.encontrado) {
    return { resultado: 'nao_encontrado', sugestao: null };
  }
  if (dadosBusca.multiplos) {
    return { resultado: 'requer_escolha', sugestao: null, pacientes: dadosBusca.pacientes || [] };
  }

  const { sugestao, lacunas } = await executarRenderizacao(processo, dadosBusca.situacao, contexto, templates);
  if (lacunas) {
    return { resultado: 'sem_dado_suficiente', sugestao: null, lacunas };
  }
  return { resultado: 'sugestao', sugestao, situacao: dadosBusca.situacao };
}

module.exports = { executarProcesso, encontrarProcesso };
