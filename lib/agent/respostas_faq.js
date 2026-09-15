// Respostas para intenções que não dependem de dado nenhum do paciente —
// nunca passam pelo motor de processos (lib/processos/motor.js), que por
// desenho exige um identificador (código/CPF/nome) e uma consulta ao apLIS
// antes de renderizar qualquer coisa. "Orientação de preparo" é a mesma
// instrução para qualquer paciente, então não faz sentido forçá-la por esse
// caminho: aqui a busca não existe, só a resposta.
//
// O texto vem direto de public/quick_responses.js (nunca duplicado à mão,
// para nunca divergir do catálogo real) e NUNCA passa pelo redator (LLM):
// são instruções quase-clínicas — jejum, coleta de amostra — e reparafrasear
// isso por um modelo arrisca alterar um detalhe que importa (duração do
// jejum, por exemplo). A garantia de "nunca inventar" aqui vem de nunca
// gerar texto, só citar o que o laboratório já aprovou.
const { QUICK_RESPONSES } = require('../../public/quick_responses.js');

function buscarRespostaRapida(id) {
  const resposta = QUICK_RESPONSES.find((r) => r.id === id);
  if (!resposta) {
    // Falha alto no carregamento do módulo — um id renomeado ou removido do
    // catálogo não pode só quebrar silenciosamente na primeira pergunta real.
    throw new Error(`Resposta Rápida "${id}" não existe — lib/agent/respostas_faq.js depende dela.`);
  }
  return resposta;
}

const RESPOSTAS_FAQ = {
  orientacao_preparo: {
    texto: buscarRespostaRapida('PREPARO').text,
    baseadoEm: 'PREPARO'
  }
};

function obterRespostaFaq(intencao) {
  return RESPOSTAS_FAQ[intencao] || null;
}

module.exports = { obterRespostaFaq, RESPOSTAS_FAQ };
