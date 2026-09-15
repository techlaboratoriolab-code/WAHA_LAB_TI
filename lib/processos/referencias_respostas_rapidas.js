// Trechos de estilo extraídos do catálogo de Respostas Rápidas
// (public/quick_responses.js, NUNCA alterado por este arquivo) — servem só de
// referência de tom e estrutura para o redator (lib/agent/redator.js).
// A mensagem final não precisa ser parecida com isto, só manter o padrão.
//
// Removido de propósito ao copiar: o nome do paciente ([Nome da Paciente]) e a
// auto-apresentação fixa ("Me chamo Thainá") que o texto original de 'dispo'/
// 'pcr' carrega — o sistema já assina com o nome de quem está atendendo de
// verdade, então uma referência com nome fixo seria uma mentira institucional
// se copiada ao pé da letra por qualquer outro atendente.
const REFERENCIAS_RESPOSTA_RAPIDA = {
  biologiamolecular: {
    origemId: 'biologiamolecular',
    texto: 'Gostaríamos de informar que o seu exame foi devidamente encaminhado para análise. O prazo estimado para o resultado é de alguns dias úteis, contados a partir da data de coleta — esse tipo de exame pode envolver etapas laboratoriais mais complexas, o que justifica o tempo de processamento. Assim que o laudo estiver disponível, você poderá acessá-lo pelo nosso portal. Estamos à disposição caso tenha dúvidas!'
  },
  site: {
    origemId: 'site',
    texto: 'Foi enviado o protocolo com o login e a senha para acessar o resultado no nosso portal, pelo link: https://lab.aplis.inf.br/index.php'
  }
};

module.exports = { REFERENCIAS_RESPOSTA_RAPIDA };
