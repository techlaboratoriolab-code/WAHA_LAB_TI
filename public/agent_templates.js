// Templates do agente. Cada um tem placeholders {{slot}} e a lista de slots
// que TÊM que estar presentes — faltando um deles, o motor omite o template
// em vez de mandar uma frase capenga. Sem alteração em quick_responses.js.
//
// Isomórfico: carregado via <script> no navegador (global AGENT_TEMPLATES) e
// via require() no servidor, para que o motor de processos renderize com o
// mesmo texto nos dois lugares.
const AGENT_TEMPLATES = {
  previsao_entrega: {
    texto: 'Olá! Sobre o exame de {{exame}}: a previsão de entrega é {{dtaPrevista}}. Qualquer novidade, avisamos por aqui. 😊',
    slotsObrigatorios: ['exame', 'dtaPrevista']
  },
  status_exame: {
    texto: 'Olá! Sobre o exame de {{exame}}: {{statusCliente}}.',
    slotsObrigatorios: ['exame', 'statusCliente']
  },
  // Usa o mesmo status ao cliente do requisicaoStatus (não presume "já pronto")
  // e sempre aponta para o portal — nunca anexa o laudo aqui.
  laudo_disponivel: {
    texto: 'Sobre o laudo do seu exame de {{exame}}: {{statusCliente}} Você pode acompanhar e acessar pelo portal, com o login e a senha já enviados: https://lab.aplis.inf.br/index.php',
    slotsObrigatorios: ['exame', 'statusCliente']
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AGENT_TEMPLATES;
}
