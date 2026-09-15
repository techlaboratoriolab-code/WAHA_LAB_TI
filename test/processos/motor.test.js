const { test } = require('node:test');
const assert = require('node:assert/strict');
const { executarProcesso, encontrarProcesso } = require('../../lib/processos/motor');

function ferramentasFake(retorno) {
  const chamadas = [];
  return {
    chamadas,
    consultarPaciente: async (identificadores) => {
      chamadas.push(identificadores);
      return typeof retorno === 'function' ? retorno(identificadores) : retorno;
    }
  };
}

const SITUACAO_UNICA = {
  encontrado: true,
  multiplos: false,
  situacao: { codRequisicao: '0210029277004', paciente: 'MARIA DA SILVA', exame: 'Citologia', dtaPrevista: '20/09/2026', statusCliente: 'Em análise', situacaoExame: 'em_andamento' }
};

test('encontrarProcesso localiza pelo campo intencao', () => {
  const catalogo = [{ id: 'a', intencao: 'x' }, { id: 'b', intencao: 'y' }];
  assert.equal(encontrarProcesso(catalogo, 'y').id, 'b');
  assert.equal(encontrarProcesso(catalogo, 'z'), null);
});

test('processo 100% declarativo: busca -> renderiza -> resultado com sugestão', async () => {
  const processo = {
    id: 'previsao_entrega',
    intencao: 'previsao_entrega',
    buscar: { tipo: 'consultarPaciente' },
    renderizar: { templateId: 'previsao_entrega', slots: { paciente: 'situacao.paciente', exame: 'situacao.exame', dtaPrevista: 'situacao.dtaPrevista' } }
  };
  const templates = { previsao_entrega: { texto: 'Olá {{paciente}}, seu exame de {{exame}} está previsto para {{dtaPrevista}}.', slotsObrigatorios: ['paciente', 'exame', 'dtaPrevista'] } };
  const ferramentas = ferramentasFake(SITUACAO_UNICA);

  const r = await executarProcesso(processo, { identificadores: { cpf: '11111111111' } }, ferramentas, templates);

  assert.equal(r.resultado, 'sugestao');
  assert.equal(r.sugestao.templateId, 'previsao_entrega');
  assert.equal(r.sugestao.texto, 'Olá MARIA DA SILVA, seu exame de Citologia está previsto para 20/09/2026.');
  assert.deepEqual(ferramentas.chamadas, [{ cpf: '11111111111' }]);
});

test('slot obrigatório ausente: template é omitido e a lacuna é reportada', async () => {
  const processo = {
    id: 'previsao_entrega', intencao: 'previsao_entrega',
    buscar: { tipo: 'consultarPaciente' },
    renderizar: { templateId: 'previsao_entrega', slots: { paciente: 'situacao.paciente', dtaPrevista: 'situacao.dtaPrevista' } }
  };
  const templates = { previsao_entrega: { texto: 'Previsão: {{dtaPrevista}}', slotsObrigatorios: ['paciente', 'dtaPrevista'] } };
  const semPrevisao = { encontrado: true, multiplos: false, situacao: { ...SITUACAO_UNICA.situacao, dtaPrevista: null } };
  const ferramentas = ferramentasFake(semPrevisao);

  const r = await executarProcesso(processo, { identificadores: { cpf: '1' } }, ferramentas, templates);
  assert.equal(r.resultado, 'sem_dado_suficiente');
  assert.equal(r.sugestao, null);
  assert.deepEqual(r.lacunas, ['dtaPrevista']);
});

test('busca sem identificador nenhum: não chama ferramentas, devolve requer_identificador', async () => {
  const processo = { id: 'x', intencao: 'x', buscar: { tipo: 'consultarPaciente' }, renderizar: { templateId: 'x', slots: {} } };
  const ferramentas = ferramentasFake(SITUACAO_UNICA);
  const r = await executarProcesso(processo, { identificadores: {} }, ferramentas, {});
  assert.equal(r.resultado, 'requer_identificador');
  assert.equal(ferramentas.chamadas.length, 0);
});

test('busca não encontra nada: resultado nao_encontrado, sem renderizar', async () => {
  const processo = { id: 'x', intencao: 'x', buscar: { tipo: 'consultarPaciente' }, renderizar: { templateId: 'x', slots: {} } };
  const ferramentas = ferramentasFake({ encontrado: false });
  const r = await executarProcesso(processo, { identificadores: { cpf: '1' } }, ferramentas, {});
  assert.equal(r.resultado, 'nao_encontrado');
});

test('busca encontra múltiplos pacientes: resultado requer_escolha, expõe a lista, não renderiza nada', async () => {
  const pacientes = [{ codPaciente: 1, paciente: 'A' }, { codPaciente: 2, paciente: 'B' }];
  const processo = { id: 'x', intencao: 'x', buscar: { tipo: 'consultarPaciente' }, renderizar: { templateId: 'x', slots: {} } };
  const ferramentas = ferramentasFake({ encontrado: true, multiplos: true, pacientes });
  const r = await executarProcesso(processo, { identificadores: { nome: 'Maria' } }, ferramentas, {});
  assert.equal(r.resultado, 'requer_escolha');
  assert.deepEqual(r.pacientes, pacientes);
  assert.equal(r.sugestao, null);
});

test('etapa buscar como função: recebe ferramentas restritas, não o cliente do apLIS', async () => {
  const processo = {
    id: 'custom', intencao: 'custom',
    buscar: async (contexto, ferramentas) => {
      assert.equal(typeof ferramentas.consultarPaciente, 'function');
      assert.equal(ferramentas.aplisClient, undefined);
      return SITUACAO_UNICA;
    },
    renderizar: { templateId: 'x', slots: { paciente: 'situacao.paciente' } }
  };
  const templates = { x: { texto: '{{paciente}}', slotsObrigatorios: ['paciente'] } };
  const r = await executarProcesso(processo, { identificadores: { cpf: '1' } }, ferramentasFake(SITUACAO_UNICA), templates);
  assert.equal(r.resultado, 'sugestao');
  assert.equal(r.sugestao.texto, 'MARIA DA SILVA');
});

test('etapa renderizar como função: recebe os dados normalizados e devolve o texto', async () => {
  const processo = {
    id: 'custom', intencao: 'custom',
    buscar: { tipo: 'consultarPaciente' },
    renderizar: (situacao) => ({ templateId: 'custom', texto: `Status: ${situacao.statusCliente}` })
  };
  const r = await executarProcesso(processo, { identificadores: { cpf: '1' } }, ferramentasFake(SITUACAO_UNICA), {});
  assert.equal(r.resultado, 'sugestao');
  assert.equal(r.sugestao.texto, 'Status: Em análise');
});

test('processo em função não consegue pular o requer_escolha ao consultar ferramentas.consultarPaciente', async () => {
  const pacientes = [{ codPaciente: 1 }, { codPaciente: 2 }];
  const processo = {
    id: 'custom', intencao: 'custom',
    buscar: async (contexto, ferramentas) => ferramentas.consultarPaciente(contexto.identificadores),
    renderizar: { templateId: 'x', slots: {} }
  };
  const ferramentas = ferramentasFake({ encontrado: true, multiplos: true, pacientes });
  const r = await executarProcesso(processo, { identificadores: { nome: 'Maria' } }, ferramentas, {});
  assert.equal(r.resultado, 'requer_escolha');
});

test('renderizar em função que devolve null vira sem_dado_suficiente, nunca uma sugestão vazia', async () => {
  const processo = { id: 'custom', intencao: 'custom', buscar: { tipo: 'consultarPaciente' }, renderizar: async () => null };
  const r = await executarProcesso(processo, { identificadores: { cpf: '1' } }, ferramentasFake(SITUACAO_UNICA), {});
  assert.equal(r.resultado, 'sem_dado_suficiente');
  assert.equal(r.sugestao, null);
});

test('renderizar em função que devolve objeto sem texto também vira sem_dado_suficiente', async () => {
  const processo = { id: 'custom', intencao: 'custom', buscar: { tipo: 'consultarPaciente' }, renderizar: async () => ({ lacunas: ['statusCliente'] }) };
  const r = await executarProcesso(processo, { identificadores: { cpf: '1' } }, ferramentasFake(SITUACAO_UNICA), {});
  assert.equal(r.resultado, 'sem_dado_suficiente');
  assert.deepEqual(r.lacunas, ['statusCliente']);
});

test('renderizar em função recebe o apoio passado a executarProcesso (ex: um redator)', async () => {
  const apoio = { redigir: async () => ({ texto: 'texto do redator' }) };
  const processo = {
    id: 'custom', intencao: 'custom', buscar: { tipo: 'consultarPaciente' },
    renderizar: async (situacao, contexto, apoioRecebido) => {
      const r = await apoioRecebido.redigir();
      return { texto: r.texto };
    }
  };
  const r = await executarProcesso(processo, { identificadores: { cpf: '1' } }, ferramentasFake(SITUACAO_UNICA), {}, apoio);
  assert.equal(r.resultado, 'sugestao');
  assert.equal(r.sugestao.texto, 'texto do redator');
});

test('sem apoio, renderizar em função recebe um objeto vazio (não undefined) como terceiro argumento', async () => {
  let apoioRecebido;
  const processo = {
    id: 'custom', intencao: 'custom', buscar: { tipo: 'consultarPaciente' },
    renderizar: async (situacao, contexto, apoio) => { apoioRecebido = apoio; return { texto: 'x' }; }
  };
  await executarProcesso(processo, { identificadores: { cpf: '1' } }, ferramentasFake(SITUACAO_UNICA), {});
  assert.deepEqual(apoioRecebido, {});
});
