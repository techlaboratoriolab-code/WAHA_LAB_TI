const { AplisError } = require('./client');
const { normalizarRequisicao, extrairStatusCliente } = require('./normalizar');

const CODIGO_REQUISICAO = /^\d{13}$/;
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

module.exports = { consultarPorCodigo, formatarDataAplis };
