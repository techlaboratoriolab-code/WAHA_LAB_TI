const { AplisError } = require('./client');
const { normalizarRequisicao, extrairStatusCliente } = require('./normalizar');
const { LEN_CODIGO_REQUISICAO, LEN_CPF } = require('./formatos');

const CODIGO_REQUISICAO = new RegExp(`^\\d{${LEN_CODIGO_REQUISICAO}}$`);
const JANELA_CODIGO_MESES = 24;

function formatarDataAplis(data) {
  return data.toISOString().slice(0, 10);
}

function subtrairMeses(data, meses) {
  const d = new Date(data.getTime());
  d.setUTCMonth(d.getUTCMonth() - meses);
  return d;
}

// Um código de requisição é exato, então a janela pode ser larga sem custo:
// a lista volta com no máximo aquela requisição.
async function consultarPorCodigo(client, codRequisicao, { hoje = new Date() } = {}) {
  const cod = String(codRequisicao || '').trim();
  if (!CODIGO_REQUISICAO.test(cod)) {
    throw new AplisError('entrada_invalida', 'Informe o código da requisição com 13 dígitos.');
  }

  const lista = await client.chamar('requisicaoListar', {
    tipoData: 1,
    periodoIni: formatarDataAplis(subtrairMeses(hoje, JANELA_CODIGO_MESES)),
    periodoFim: formatarDataAplis(hoje),
    codRequisicao: cod,
    pagina: 1,
    tamanho: 5
  });

  // O filtro codRequisicao do apLIS não é estrito: sem correspondência ele devolve
  // a lista geral do período. Só um código exatamente igual conta como encontrado —
  // qualquer fallback aqui entregaria a requisição de outro paciente.
  const itens = Array.isArray(lista.lista) ? lista.lista : [];
  const item = itens.find((i) => String(i.CodRequisicao) === cod);
  if (!item) {
    return { encontrado: false, codRequisicao: cod };
  }

  const requisicao = normalizarRequisicao(item);

  let statusCliente = null;
  try {
    const status = await client.chamar('requisicaoStatus', { codRequisicao: cod });
    statusCliente = extrairStatusCliente(status);
  } catch (e) {
    // O cartão fica de pé só com a lista; o texto ao cliente é complemento.
  }

  return { encontrado: true, requisicao: { ...requisicao, statusCliente } };
}

const JANELA_PADRAO_DIAS = 90;
const JANELA_AMPLIADA_MESES = 24;
const JANELA_AMPLIADA_DIAS_NOMINAL = 730; // rótulo para a interface; o período real é calculado em meses
const TAMANHO_PAGINA_BUSCA = 50;

// código (13 dígitos) | cpf (11 dígitos, com ou sem pontuação) | nome (≥ 3 caracteres)
function classificarTermo(termo) {
  const bruto = String(termo || '').trim();
  if (!bruto) return null;
  const digitos = bruto.replace(/\D/g, '');
  if (CODIGO_REQUISICAO.test(bruto)) return { tipo: 'codigo', valor: bruto };
  if (digitos.length === LEN_CPF && /^[\d.\-\s]+$/.test(bruto)) return { tipo: 'cpf', valor: digitos };
  if (bruto.length < 3) return null;
  return { tipo: 'nome', valor: bruto };
}

function subtrairDias(data, dias) {
  return new Date(data.getTime() - dias * 86400000);
}

function normalizarTexto(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

// O filtro do apLIS não é confiável (ver consultarPorCodigo): cada item devolvido
// tem que bater de fato com o termo, ou é descartado. Nome compara sem acento e
// sem caixa; CPF compara só os dígitos.
function itemBateComTermo(item, classificado) {
  if (classificado.tipo === 'cpf') {
    return String(item.CPF || '').replace(/\D/g, '') === classificado.valor;
  }
  return normalizarTexto(item.NomPaciente).includes(normalizarTexto(classificado.valor));
}

function chaveData(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(String(texto || ''));
  if (!m) return 0;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0));
}

// Busca requisições por CPF ou nome e agrupa por paciente. Com um único paciente
// o status ao cliente da requisição mais recente é buscado; com vários, nada é
// aprofundado até o atendente escolher — é a barreira contra o homônimo.
async function buscarPorPaciente(client, termo, { hoje = new Date(), ampliar = false } = {}) {
  const classificado = classificarTermo(termo);
  if (!classificado || classificado.tipo === 'codigo') {
    throw new AplisError('entrada_invalida', 'Informe um CPF ou um nome com pelo menos 3 caracteres.');
  }

  const janelaDias = ampliar ? JANELA_AMPLIADA_DIAS_NOMINAL : JANELA_PADRAO_DIAS;
  const periodoIni = ampliar ? subtrairMeses(hoje, JANELA_AMPLIADA_MESES) : subtrairDias(hoje, JANELA_PADRAO_DIAS);

  const lista = await client.chamar('requisicaoListar', {
    tipoData: 1,
    periodoIni: formatarDataAplis(periodoIni),
    periodoFim: formatarDataAplis(hoje),
    nomPaciente: classificado.valor,
    pagina: 1,
    tamanho: TAMANHO_PAGINA_BUSCA
  });

  const devolvidos = Array.isArray(lista.lista) ? lista.lista : [];
  const itens = devolvidos.filter((it) => itemBateComTermo(it, classificado));
  const total = Number(lista.registros);
  const base = {
    termo: classificado.valor,
    tipo: classificado.tipo,
    janelaDias,
    total: Number.isNaN(total) ? itens.length : total,
    // Uma página só: com nome muito comum a lista de pacientes pode estar incompleta.
    truncado: !Number.isNaN(total) && total > devolvidos.length
  };
  if (itens.length === 0) {
    return { encontrado: false, ...base, pacientes: [] };
  }

  const porPaciente = new Map();
  for (const it of itens) {
    const req = normalizarRequisicao(it);
    const chave = req.codPaciente != null
      ? String(req.codPaciente)
      : (req.paciente ? `sem-id:${req.paciente}` : `sem-paciente:${req.codRequisicao}`);
    if (!porPaciente.has(chave)) {
      porPaciente.set(chave, {
        codPaciente: req.codPaciente,
        paciente: req.paciente,
        cpfFinal: req.cpf ? String(req.cpf).replace(/\D/g, '').slice(-4) : null,
        requisicoes: []
      });
    }
    porPaciente.get(chave).requisicoes.push(req);
  }

  const pacientes = [...porPaciente.values()];
  for (const p of pacientes) {
    p.requisicoes.sort((a, b) => chaveData(b.dtaSolicitacao) - chaveData(a.dtaSolicitacao));
  }
  pacientes.sort((a, b) => chaveData(b.requisicoes[0].dtaSolicitacao) - chaveData(a.requisicoes[0].dtaSolicitacao));

  if (pacientes.length === 1) {
    const maisRecente = pacientes[0].requisicoes[0];
    let statusCliente = null;
    try {
      const status = await client.chamar('requisicaoStatus', { codRequisicao: maisRecente.codRequisicao });
      statusCliente = extrairStatusCliente(status);
    } catch (e) {
      // O cartão fica de pé só com a lista.
    }
    maisRecente.statusCliente = statusCliente;
  }

  return { encontrado: true, ...base, pacientes };
}

module.exports = { consultarPorCodigo, buscarPorPaciente, classificarTermo, formatarDataAplis };
