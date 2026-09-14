const SITUACAO_POR_STATUS = { 0: 'em_andamento', 1: 'concluido', 2: 'cancelado' };

function ouNulo(valor) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === 'string' && valor.trim() === '') return null;
  return valor;
}

// Item da lista devolvida por requisicaoListar (usuário interno) -> formato interno estável.
function normalizarRequisicao(item) {
  const statusExame = Number(item.StatusExame);
  return {
    codRequisicao: String(item.CodRequisicao),
    codPaciente: ouNulo(item.CodPaciente),
    paciente: ouNulo(item.NomPaciente),
    cpf: ouNulo(item.CPF),
    exame: ouNulo(item.NomExame),
    statusExame: Number.isNaN(statusExame) ? null : statusExame,
    situacao: SITUACAO_POR_STATUS[statusExame] || 'desconhecido',
    status: ouNulo(item.DesEvento),
    dtaSolicitacao: ouNulo(item.DtaSolicitacao),
    dtaPrevista: ouNulo(item.DtaPrevista),
    dtaFinalizacao: ouNulo(item.DtaFinalizacao),
    prioridade: ouNulo(item.CodPrioridade)
  };
}

// O apLIS devolve datas como "DD/MM/AAAA HH:MM" (não o formato de entrada
// documentado). Converte para um número comparável; NaN se não reconhecer.
function chaveDataAplis(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(texto || '').trim());
  if (!m) return NaN;
  const [, dia, mes, ano, hora = '0', min = '0', seg = '0'] = m;
  return Date.UTC(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(min), Number(seg));
}

// Do retorno de requisicaoStatus, o texto de status voltado ao cliente da entrada
// mais recente. descricaoCliente é o campo desenhado para exibição ao paciente;
// a descricao interna só entra quando ele está vazio. Se alguma data não for
// parseável, confia na ordem em que o apLIS devolveu (cronológica).
function extrairStatusCliente(dat) {
  const historico = dat && Array.isArray(dat.historico) ? dat.historico : [];
  if (historico.length === 0) return null;

  const chaves = historico.map((h) => chaveDataAplis(h.data));
  let maisRecente = historico[historico.length - 1];
  if (chaves.every((k) => !Number.isNaN(k))) {
    const idx = chaves.reduce((melhor, k, i) => (k > chaves[melhor] ? i : melhor), 0);
    maisRecente = historico[idx];
  }
  return ouNulo(maisRecente.descricaoCliente) || ouNulo(maisRecente.descricao);
}

module.exports = { normalizarRequisicao, extrairStatusCliente };
