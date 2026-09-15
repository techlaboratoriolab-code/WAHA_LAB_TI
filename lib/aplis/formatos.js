// Convenções de formato dos identificadores do apLIS, compartilhadas entre a
// classificação de termo digitado (lib/aplis/consultas.js) e o reconhecimento
// por regex no texto da conversa (lib/processos/identificadores.js) — as duas
// não podem divergir sobre o que conta como código de requisição ou CPF.
const LEN_CODIGO_REQUISICAO = 13;
const LEN_CPF = 11;

module.exports = { LEN_CODIGO_REQUISICAO, LEN_CPF };
