// Trechos de estilo extraídos do catálogo de Respostas Rápidas
// (public/quick_responses.js, NUNCA alterado por este arquivo) — servem de
// referência de tom e estrutura para o redator (lib/agent/redator.js).
//
// Diferente da primeira versão (uma referência fixa por processo), o pool
// inteiro é oferecido a todos os processos do MVP e é o próprio redator quem
// escolhe, a cada chamada, qual referência (se alguma) melhor se encaixa no
// que a conversa real está pedindo — não é mais uma escolha travada em tempo
// de escrita do catálogo. A mensagem final não precisa ser parecida com
// nenhuma delas, só manter o mesmo padrão de cordialidade e clareza.
//
// Removido de propósito ao copiar, em todo o pool: nome do paciente
// ([Nome da Paciente]/[Nome do Paciente]), auto-apresentação fixa por nome
// ("Me chamo Thainá" etc — o sistema já assina com o nome de quem está
// atendendo de verdade) e exames específicos de outra situação, para que
// nenhuma referência carregue um dado que passaria por fato se copiado ao
// pé da letra por outro atendente ou processo.
const REFERENCIAS_RESPOSTA_RAPIDA = {
  biologiamolecular: {
    texto: 'Gostaríamos de informar que o seu exame foi devidamente encaminhado para análise. O prazo estimado para o resultado é de alguns dias úteis, contados a partir da data de coleta — esse tipo de exame pode envolver etapas laboratoriais mais complexas, o que justifica o tempo de processamento. Assim que o laudo estiver disponível, você poderá acessá-lo pelo nosso portal. Estamos à disposição caso tenha dúvidas!'
  },
  site: {
    texto: 'Foi enviado o protocolo com o login e a senha para acessar o resultado no nosso portal, pelo link: https://lab.aplis.inf.br/index.php'
  },
  prot: {
    texto: 'O protocolo em PDF encaminhado contém as credenciais de acesso ao sistema. Após a abertura do arquivo, utilize as informações nele disponíveis (usuário e senha) para acessar o link abaixo e acompanhar o andamento do exame. Quando o exame estiver laudado, o resultado poderá ser visualizado e baixado diretamente pelo sistema: https://lab.aplis.inf.br/index.php'
  },
  dispo: {
    texto: 'Bom dia, tudo bem? Falamos em nome do Laboratório LAB. Viemos informar que o laudo do seu exame já está disponível. Segue abaixo o protocolo de acesso digital para visualização do resultado. Permanecemos à disposição.'
  },
  pcr: {
    texto: 'Bom dia, tudo bem? Falamos em nome do Laboratório LAB. Viemos informar que o laudo de um dos seus exames já está disponível. Obs: outro exame permanece em análise, com previsão de data. Segue abaixo o protocolo de acesso digital para visualização do resultado. Permanecemos à disposição.'
  },
  atraso: {
    texto: 'Passando para informar que o laudo poderá atrasar devido à demora do convênio para autorizar.'
  },
  remarcacao: {
    texto: 'Boa tarde,\nA previsão do resultado foi atualizada devido a um ajuste interno do laboratório, que faz parte do nosso processo padrão de qualidade.\nAgradecemos a compreensão e seguimos à disposição.'
  }
};

module.exports = { REFERENCIAS_RESPOSTA_RAPIDA };
