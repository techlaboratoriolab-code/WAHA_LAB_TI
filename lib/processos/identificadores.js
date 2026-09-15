const { LEN_CODIGO_REQUISICAO, LEN_CPF } = require('../aplis/formatos');

// Reconhecimento determinístico de identificadores no texto da conversa — não
// depende do modelo. Roda sempre, mesmo que a classificação de intenção falhe.
// Os comprimentos vêm de lib/aplis/formatos.js: a mesma convenção que decide
// se um termo digitado é código ou CPF na busca manual (lib/aplis/consultas.js).
const RE_CODIGO = new RegExp(`\\b\\d{${LEN_CODIGO_REQUISICAO}}\\b`);
// Grupos de um CPF (3+3+3+2 = 11 = LEN_CPF), com pontuação opcional.
const RE_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const RE_CREDENCIAL_PORTAL = /\bP\d{5,6}\b/i;

function primeiraOcorrencia(texto, regex) {
  const m = regex.exec(texto);
  return m ? m[0] : null;
}

// Recebe uma mensagem (string) ou várias (array), varre todas e devolve a
// primeira ocorrência de cada tipo de identificador encontrada.
function extrairIdentificadoresDeTexto(mensagens) {
  const lista = Array.isArray(mensagens) ? mensagens : [mensagens];
  const texto = lista.filter((m) => typeof m === 'string').join('\n');

  const codRequisicao = primeiraOcorrencia(texto, RE_CODIGO);
  const cpfBruto = primeiraOcorrencia(texto, RE_CPF);
  const credencialBruta = primeiraOcorrencia(texto, RE_CREDENCIAL_PORTAL);

  return {
    codRequisicao: codRequisicao || null,
    cpf: cpfBruto ? cpfBruto.replace(/\D/g, '') : null,
    credencialPortal: credencialBruta ? credencialBruta.toUpperCase() : null
  };
}

module.exports = { extrairIdentificadoresDeTexto };
