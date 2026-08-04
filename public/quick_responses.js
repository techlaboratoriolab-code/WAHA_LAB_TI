// Respostas Rápidas - Laboratório LAB
const QUICK_RESPONSES = [
  // --- ATENDIMENTO & BOAS-VINDAS ---
  {
    id: 'obrigado',
    title: 'Agradecimento Inicial',
    category: 'Atendimento',
    tags: ['obrigado', 'agradecimento', 'início'],
    text: 'Agradeço por entrar em contato! No momento não poderei responder mas não se preocupe, entrarei em contato assim que possível. 😃'
  },
  {
    id: 'o',
    title: 'Olá, Bom dia',
    category: 'Atendimento',
    tags: ['olá', 'bom dia', 'saudação'],
    text: 'Olá, bom dia. Tudo bem?'
  },
  {
    id: '09',
    title: 'Confirmação de Contato (Alexya)',
    category: 'Atendimento',
    tags: ['atendimento', 'alexya', 'confirmação'],
    text: 'Olá, boa tarde! Me chamo Alexya e falo em nome do LAB Laboratório. Poderia, por gentileza, confirmar se falo com [Nome do Paciente]?'
  },
  {
    id: 'Olá',
    title: 'Apresentação Digitalização Lâminas',
    category: 'Atendimento',
    tags: ['novidade', 'lâminas', 'tecnologia'],
    text: 'Olá! Tudo bem? Notamos que você deixou seu exame no Lab, e queremos aproveitar para compartilhar uma novidade! Pensando em oferecer sempre o melhor atendimento e acompanhar os avanços da tecnologia na saúde, nosso laboratório agora conta com um serviço exclusivo: digitalização de lâminas em alta resolução. Com esse recurso, as lâminas analisadas podem ser convertidas em imagens digitais de altíssima qualidade, trazendo diversos benefícios: Maior transparência diagnóstica. Possibilidade de revisão remota por especialistas, quando necessário. Acesso fácil às imagens, a qualquer momento. Ao optar pelo serviço, você recebe um link exclusivo para download, podendo guardar suas imagens da forma que preferir e por quanto tempo quiser. Essa novidade reforça nosso compromisso com a qualidade, a transparência e, principalmente, com o seu bem-estar. Se tiver dúvidas ou quiser saber mais, é só falar com a nossa equipe — estamos aqui para ajudar!'
  },

  // --- GUIA & AUTENTIQUE & ASSINATURA ---
  {
    id: 'guia',
    title: 'Solicitação de Assinatura na Guia (Autentique)',
    category: 'Guias & Assinatura',
    tags: ['guia', 'assinatura', 'autentique', 'exame'],
    text: 'Olá, Sr.(a) [Nome do Paciente], tudo bem? Me chamo [Seu Nome] e falo em nome do *Laboratório LAB*. Recebemos sua amostra para realização do exame de [Nome do Exame], proveniente da [Nome da Clínica]. Identificamos que a guia do convênio foi enviada sem a sua assinatura, uma exigência do convênio para darmos continuidade ao processo. Para facilitar, iremos enviar um link pelo WhatsApp, via plataforma segura *Autentique*, onde você poderá assinar digitalmente de forma rápida e simples, direto pelo celular. Agradecemos pela atenção e estamos à disposição em caso de dúvidas. *Laboratório LAB*'
  },
  {
    id: 'Assinaturaguia',
    title: 'Informação Guia no Autentique',
    category: 'Guias & Assinatura',
    tags: ['assinatura', 'autentique', 'convênio'],
    text: 'Prezado(a) [Nome do Paciente], Informamos que a guia disponível para assinatura no aplicativo Autentique refere-se à análise do material colhido na clínica [Nome da Clínica]. Para que possamos dar continuidade ao processo e liberar o laudo, é necessário que a guia seja assinada, possibilitando assim o envio ao convênio. Agradecemos sua atenção e estamos à disposição para qualquer dúvida. Atenciosamente, Laboratório LAB.'
  },
  {
    id: 'Encaminhei',
    title: 'Link Autentique Enviado',
    category: 'Guias & Assinatura',
    tags: ['enviado', 'autentique', 'sucesso'],
    text: '✅ *Documento Enviado com Sucesso!* 📱 O link de assinatura digital foi enviado pelo *Autentique*. Você receberá o link em instantes via WhatsApp. 👉 *Importante:* Clique no link e assine o documento para finalizar o processo. Pode conferir o recebimento?'
  },
  {
    id: 'ASSINAR',
    title: 'Instruções para Assinar Digitalmente',
    category: 'Guias & Assinatura',
    tags: ['instruções', 'passo a passo', 'assinar'],
    text: 'É só clicar em "Assinar" – vai pedir o seu CPF e, em seguida, uma senha de 8 dígitos, que pode ser numérica (de 1 a 8, por exemplo). Automaticamente, será gerada uma assinatura válida e aceita pelo seu convênio.'
  },
  {
    id: 'Explicação',
    title: 'Explicação da Exigência de Assinatura',
    category: 'Guias & Assinatura',
    tags: ['explicação', 'faturamento', 'convênio'],
    text: 'Bom dia! A assinatura é para que possamos enviar ao faturamento. Todos os procedimentos que são realizados pelo convênio exigem que o paciente assine guias, uma vez que será pela operadora que o exame estará sendo coberto. Nós só vamos mandar a guia para assinar digitalmente, para facilitar o processo e não precisar que a senhora se desloque até o laboratório para realizar esse passo. A guia já está liberada! O convênio já autorizou, mas sem assinatura não tem validade na hora de faturar.'
  },
  {
    id: 'pronto',
    title: 'Exame Pronto Aguardando Assinatura',
    category: 'Guias & Assinatura',
    tags: ['pronto', 'laudado', 'assinatura'],
    text: 'Seu exame já está pronto e laudado. Porém, para concluirmos a fase de autorização junto ao convênio, estamos solicitando a sua assinatura na guia para finalização do processo.'
  },
  {
    id: 'Obrigada',
    title: 'Agradecimento por Assinatura Recebida',
    category: 'Guias & Assinatura',
    tags: ['recebida', 'obrigada', 'confirmação'],
    text: 'Obrigada, recebemos a sua assinatura! Tenha uma excelente semana. 😄 Agradecemos pela colaboração! *Laboratório LAB* - Estamos à disposição. 🏥'
  },
  {
    id: 'Exigência',
    title: 'Exigência Doc e Carteirinha',
    category: 'Guias & Assinatura',
    tags: ['documento', 'carteirinha', 'convênio'],
    text: 'O motivo do meu contato é para solicitar que nos envie uma copia do Documento pessoal e da carteirinha do Convenio da Sra. [Nome da Paciente] para anexarmos na guia. Exigência do Convenio. Aguardo retorno. Grata!'
  },
  {
    id: 'prezado',
    title: 'Reforço Assinatura p/ Parceiros',
    category: 'Guias & Assinatura',
    tags: ['parceiro', 'clínica', 'guias'],
    text: 'Prezado parceiro, boa tarde! Gostaria de reforçar a importância da assinatura das guias pelos pacientes. Temos observado uma resistência por parte de alguns pacientes no moment da assinatura digital. Assim, gostaríamos de destacar que a paciente pode assinar tanto no campo "assinatura do paciente" no nosso pedido médico quanto na guia SADT, e nos enviar ambas as assinaturas juntamente com o pedido médico. Contamos com a sua compreensão e colaboração para evitar contratempos, visto que muitos pacientes têm se mostrado relutantes em realizar a assinatura. Agradeço pela atenção e estou à disposição para quaisquer esclarecimentos. Atenciosamente, Laboratório Lab'
  },

  // --- CONVÊNIOS & AUTORIZAÇÕES ---
  {
    id: 'ConvenioNaoAtendido',
    title: 'Convênio Não Atendido',
    category: 'Convênios',
    tags: ['não atendido', 'comercial', 'desconto'],
    text: 'Olá, Sr(a). [Nome do Paciente], falo em nome do Laboratório LAB. Recebemos sua amostra para o exame de [Nome do Exame], que foi coletada na [Nome da Clínica Parceira]. Ao processarmos sua guia, verificamos que, no momento, não atendemos o convênio [Nome do Convênio]. Mas, para garantir que você possa realizar seu exame com tranquilidade, nossa equipe comercial entrará em contato com o(a) senhor(a) em até 24 horas para oferecer uma condição especial e personalizada para a realização do exame. Atenciosamente, Atendimento Laboratório LAB'
  },
  {
    id: 'Nãoatendemos',
    title: 'Sem Convênio (Mensagem Curta)',
    category: 'Convênios',
    tags: ['convênio', 'desconto', 'reembolso'],
    text: 'Infelizmente, no momento, não atendemos este convênio. No entanto, para situações como essa, oferecemos um desconto especial, com o objetivo de facilitar o reembolso direto com o convênio. Você poderia, por gentileza, nos enviar o pedido médico para que possamos verificar as opções disponíveis?'
  },
  {
    id: 'carencia',
    title: 'Plano em Carência',
    category: 'Convênios',
    tags: ['carência', 'plano', 'particular'],
    text: 'Olá, Sr(a). [Nome do Paciente]! Falo em nome do Laboratório LAB. Recebemos sua amostra para o exame de [Nome do Exame], que foi coletada na [Nome da Clínica Parceira]. Ao processarmos sua guia junto ao convênio [Nome do Convênio], fomos informados que o seu plano está no período de carência para este procedimento. Para que você não precise aguardar o fim da carência e possa dar continuidade ao seu diagnóstico, nossa equipe comercial entrará em contato com o(a) senhor(a) em até 24 horas para oferecer uma condição especial e personalizada para a realização do exame. Atenciosamente, Equipe Laboratório LAB'
  },
  {
    id: 'AutorizouEmPartes',
    title: 'Autorização Parcial pelo Convênio',
    category: 'Convênios',
    tags: ['autorização parcial', 'aprovado', 'negado'],
    text: 'Olá, Sr(a). [Nome do Paciente]! Falo em nome do Laboratório LAB. Recebemos sua amostra para os exames, que foi coletada na [Nome da Clínica Parceira]. Ao processarmos sua guia junto ao convênio [Nome do Convênio], recebemos uma autorização parcial. O exame [Nome do Exame APROVADO] foi autorizado, porém, o exame [Nome do Exame NEGADO] não teve cobertura. Para que a senhora possa realizar seu diagnóstico completo, nossa equipe comercial entrará em contato em até 24 horas para oferecer uma condição especial para a realização do exame [Nome do Exame NEGADO]. Atenciosamente, Equipe Laboratório LAB'
  },
  {
    id: 'ConvenioNãoAutorizou',
    title: 'Convênio Não Autorizou Exame',
    category: 'Convênios',
    tags: ['não autorizou', 'negado', 'particular'],
    text: 'Olá, Sr(a). [Nome do Paciente]! Falo em nome do Laboratório LAB. Recebemos sua amostra para o(s) exame(s) de [Nome do Exame], coletada na [Nome da Clínica Parceira]. Ao submetermos sua guia para aprovação junto ao convênio [Nome do Convênio], fomos informados que a autorização para este(s) procedimento(s) não foi concedida. Mas, para que o(a) senhor(a) possa dar continuidade ao seu diagnóstico, nossa equipe comercial entrará em contato em até 24 horas para oferecer uma condição especial e personalizada para a realização do(s) exame(s) de forma particular. Atenciosamente, Equipe Laboratório LAB'
  },

  // --- LAUDOS & RESULTADOS ---
  {
    id: 'site',
    title: 'Link de Acesso ao Site',
    category: 'Laudos & Exames',
    tags: ['site', 'resultado', 'login', 'senha'],
    text: 'Foi enviado o protocolo no e-mail da Sra. nele contêm o login e a senha para acessar o resultado nesse link: https://lab.aplis.inf.br/index.php'
  },
  {
    id: 'prot',
    title: 'Instrução do PDF de Protocolo',
    category: 'Laudos & Exames',
    tags: ['protocolo', 'pdf', 'login'],
    text: 'O protocolo em PDF encaminhado contém as credenciais de acesso ao sistema. Após a abertura do arquivo, utilize as informações nele disponíveis (usuário e senha) para acessar o link abaixo e acompanhar o andamento do exame. Quando o exame estiver laudado, o resultado poderá ser visualizado e baixado diretamente pelo sistema: https://lab.aplis.inf.br/index.php *Laboratório LAB* - Permanecemos à disposição.'
  },
  {
    id: 'dispo',
    title: 'Laudos PCR e Colpocitologia Prontos',
    category: 'Laudos & Exames',
    tags: ['pcr', 'colpocitologia', 'laudo disponível'],
    text: 'Bom dia Sra. [Nome da Paciente], tudo bem? Me chamo Thainá, falo em nome do *Laboratório LAB*. Viemos informar que os laudos dos seus exames de *PCR e COLPOCITOLOGIA EM MEIO LIQUIDO* já estão disponíveis. Segue abaixo o protocolo de acesso digital para visualização do resultado. *Laboratório LAB* - Permanecemos à disposição.'
  },
  {
    id: 'pcr',
    title: 'Laudo PCR Pronto (Colpocitologia em análise)',
    category: 'Laudos & Exames',
    tags: ['pcr', 'disponível', 'previsão'],
    text: 'Bom dia Sra. [Nome da Paciente], tudo bem? Me chamo Thainá, falo em nome do *Laboratório LAB*. Viemos informar que o laudo do seu exame de *PCR* já está disponível. Obs: O exame de *COLPOCITOLOGIA EM MEIO LIQUIDO* permanece em análise e com a previsão para [Previsão de Data]. Segue abaixo o protocolo de acesso digital para visualização do resultado. *Laboratório LAB* - Permanecemos à disposição.'
  },
  {
    id: 'biologiamolecular',
    title: 'Exame de Biologia Molecular (Prazo)',
    category: 'Laudos & Exames',
    tags: ['biologia molecular', 'prazo', '7 dias'],
    text: 'Gostaríamos de informar que o seu exame de biologia molecular foi devidamente encaminhado para análise. O prazo estimado para o resultado é de 07 dias úteis, contados a partir da data de coleta. Esse tipo de exame envolve etapas laboratoriais mais complexas e detalhadas, o que justifica um tempo de processamento um pouco maior em comparação a outros testes. Assim que o laudo estiver disponível, entraremos em contato ou você poderá acessá-lo pelo nosso portal/laboratório. https://lab.aplis.inf.br/index.php Estamos à disposição caso tenha dúvidas ou precise de mais informações!'
  },
  {
    id: 'Confiance',
    title: 'Solicitação da Clínica CONFIANCE',
    category: 'Laudos & Exames',
    tags: ['confiance', 'protocolo'],
    text: 'Olá, [Nome do Paciente]. Informamos que recebemos sua solicitação de exame com sucesso, encaminhada pela Clínica CONFIANCE. Segue abaixo o protocolo de acesso para que você possa acompanhar os resultados. Qualquer dúvida, ficamos à disposição. Atenciosamente, Equipe LAB.'
  },
  {
    id: 'atraso',
    title: 'Aviso de Atraso de Laudo',
    category: 'Laudos & Exames',
    tags: ['atraso', 'laudo', 'convênio'],
    text: 'Passando para informar que o laudo da paciente [Nome da Paciente] poderá atrasar devido a demora do convênio para autorizar.'
  },
  {
    id: 'remarcação',
    title: 'Atualização de Previsão de Laudo',
    category: 'Laudos & Exames',
    tags: ['previsão', 'remarcação', 'ajuste'],
    text: 'Boa tarde,\nA previsão do resultado da paciente [Nome da Paciente] foi atualizada devido a um ajuste interno do laboratório, que faz parte do nosso processo padrão de qualidade.\n- Data original prevista: [Data Original]\n- Nova data prevista: [Nova Data]\nAgradecemos a compreensão e seguimos à disposição.\nLaboratório LAB'
  },
  {
    id: 'mensagemimuno',
    title: 'Solicitação de Imunohistoquímico pelo Patologista',
    category: 'Laudos & Exames',
    tags: ['imuno', 'patologista', 'pedido'],
    text: 'O laudo da paciente [Nome da Paciente] foi liberado. O médico patologista está solicitando Imunohistoquímico. O/A Dra. prefere que o paciente vá ao retorno para emitir o pedido no dia ou gostaria de enviar o pedido antes?'
  },
  {
    id: 'imuno',
    title: 'Explicação: O que é Imuno-histoquímica (IHQ)',
    category: 'Laudos & Exames',
    tags: ['imuno', 'explicação', 'ihq'],
    text: 'A imuno-histoquímica (IHQ) é uma técnica de laboratório usada principalmente em patologia para identificar proteínas específicas em tecidos biológicos, utilizando anticorpos marcados com substâncias que permitem visualizar essas proteínas ao microscópio. Como funciona: Amostra de tecido (geralmente fixada em formol e embebida em parafina) é cortada em lâminas finas. Aplica-se um anticorpo específico que reconhece a proteína de interesse. Esse anticorpo está ligado a um marcador. Para que serve: Diagnóstico de câncer, identificação de infecções e determinação de tipo celular.'
  },
  {
    id: 'LaudoAntigo',
    title: 'Solicitação de Busca de Laudo Antigo',
    category: 'Laudos & Exames',
    tags: ['laudo antigo', 'arquivo', '7 dias'],
    text: 'Para laudos mais antigos, precisamos realizar uma busca detalhada em nosso sistema de arquivo digital. Para garantir que encontraremos o documento correto, por favor, poderia me informar os seguintes dados?\nNome completo:\nCPF:\nData de nascimento:\nO ano aproximado em que o exame foi realizado:\nCom essas informações, nossa equipe iniciará a busca. Como é um processo manual em nosso arquivo, pedimos um prazo de até 7 dias úteis para localizar e enviar o seu laudo. Faremos o possível para te enviar o quanto antes! Agradecemos a sua compreensão e paciência. Atenciosamente, Equipe Laboratório LAB'
  },
  {
    id: 'laudoauditoria',
    title: 'Envio de Laudo p/ Hospital (Compliance)',
    category: 'Laudos & Exames',
    tags: ['compliance', 'auditoria', 'hospital'],
    text: 'Olá, lamentamos, mas devido às políticas de nossa empresa, não temos a permissão para compartilhar o laudo com o hospital sem a autorização prévia de nosso setor de Compliance. Solicitamos que, para resolver esta situação, por gentileza, entre em contato diretamente com nosso departamento de Compliance. O responsável é o Dr. Rodrigo Pucci, cujo endereço de e-mail é compliance@apradvogados.adv.br. Estamos à disposição para quaisquer outras questões ou esclarecimentos adicionais.'
  },

  // --- PRIVACIDADE & LGPD ---
  {
    id: 'protocolo',
    title: 'Solicitação de Selfie + Doc (LGPD)',
    category: 'LGPD & Privacidade',
    tags: ['lgpd', 'selfie', 'documento', 'protocolo'],
    text: 'De acordo com as diretrizes da Lei Geral de Proteção de Dados n 13.709, precisamos confirmar alguns dados para liberar a senha de acesso. E para isso, é necessário que nos encaminhe: Nome completo: CPF: data de nascimento: e-mail: e selfie do paciente segurando o documento próximo ao rosto. O documento deve aparecer por completo (contendo foto, nome, data de nascimento e CPF), de forma nítida e legível.'
  },
  {
    id: 'LGPD',
    title: 'Envio de Dados Sensíveis por E-mail (LGPD)',
    category: 'LGPD & Privacidade',
    tags: ['lgpd', 'email', 'dados sensíveis'],
    text: 'Olá, Prezado(a) paciente. Informamos que, em conformidade com a Lei Geral de Proteção de Dados (LGPD), determinadas informações classificadas como dados sensíveis só podem ser compartilhadas de forma segura e individualizada. Por esse motivo, os dados em questão serão enviados exclusivamente por e-mail, garantindo a confidencialidade e a segurança das informações. Agradecemos a compreensão e seguimos à disposição para quaisquer esclarecimentos.'
  },
  {
    id: 'Enviodelaudo',
    title: 'Proibição de Laudo pelo WhatsApp (LGPD)',
    category: 'LGPD & Privacidade',
    tags: ['lgpd', 'whatsapp', 'laudo por email'],
    text: 'Prezado(a) paciente, informamos que, de acordo com a Lei nº 13.709/2018 – Lei Geral de Proteção de Dados Pessoais (LGPD), não estamos autorizados a disponibilizar laudos médicos por meio do WhatsApp, visando garantir a segurança, a confidencialidade e a integridade das informações e dados sensíveis dos pacientes. Para maior segurança, o acesso aos laudos será disponibilizado exclusivamente via e-mail. Agradecemos a compreensão. Estamos à disposição para quaisquer esclarecimentos.'
  },
  {
    id: 'Negativadeselfie',
    title: 'Resposta para Negativa de Envio de Selfie',
    category: 'LGPD & Privacidade',
    tags: ['selfie', 'negativa', 'lgpd'],
    text: 'Compreendemos sua solicitação. No entanto, por se tratar de dados sensíveis do paciente, somente podemos enviar as informações do protocolo mediante a confirmação da selfie do paciente junto com o documento de identificação. Essa medida é necessária para garantir a segurança e a privacidade das informações. Agradecemos sua compreensão e permanecemos à disposição para qualquer esclarecimento.'
  },
  {
    id: 'Justificativaselfie',
    title: 'Justificativa Detalhada Exigência Selfie',
    category: 'LGPD & Privacidade',
    tags: ['justificativa', 'selfie', 'lgpd'],
    text: 'Solicitamos a selfie segurando um documento com foto para garantir que o acesso ao seu laudo seja feito com total segurança e exclusivamente por você. Essa medida protege seus dados pessoais e sensíveis, como determina a Lei Geral de Proteção de Dados Pessoais (LGPD – Lei nº 13.709/2018). De acordo com a LGPD, somos responsáveis por adotar medidas de segurança para evitar o acesso indevido a informações de saúde dos pacientes. A validação da identidade por imagem é uma forma eficaz de prevenção contra fraudes e garante que os dados estejam sendo acessados apenas pelo titular. Ressaltamos que essa imagem é utilizada apenas para a verificação de identidade e não é compartilhada com terceiros, mantendo-se protegida de acordo com nossas políticas internas de segurança da informação. Estamos à disposição para esclarecer qualquer outra dúvida.'
  },

  // --- LOCALIZAÇÃO, PREPARO & INFORMAÇÕES ---
  {
    id: 'EnderecoLab',
    title: 'Endereço Completo & Estac. LAB',
    category: 'Informações',
    tags: ['endereço', 'estacionamento', 'localização'],
    text: 'LAB – Laboratório de Medicina Diagnóstica 📍 Endereço: SHLS 716 – Centro Médico de Brasília, Bloco E, 2º andar, salas 203 a 205 – Asa Sul, Brasília/DF. 📌 Referência: Próximo do Hospital Santa Lúcia Sul (150 metros) 👨‍⚕️ Nossa equipe está pronta para oferecer um atendimento de excelência, com qualidade, precisão e cuidado nos seus exames. 🚗 Estacionamento – você pode escolher entre duas opções: 1️⃣ Primeira à direita – Estacionamento do Bloco D (cerca de 100m do Bloco E) 2️⃣ Segunda à direita – Estacionamento a apenas 50m do Bloco E 💳 Desconto no estacionamento: Basta informar na recepção que você está utilizando o estacionamento para receber o desconto. Será um prazer recebê-lo! 😊'
  },
  {
    id: 'endereço',
    title: 'Endereço Curto',
    category: 'Informações',
    tags: ['endereço', 'curto'],
    text: 'LAB – Laboratório de Medicina Diagnóstica 📍 Endereço: SHLS 716 – Centro Médico de Brasília, Bloco E, 2º andar, salas 203 a 205 – Asa Sul, Brasília/DF. 📌 Referência: Próximo do Hospital Santa Lúcia Sul (150 metros).'
  },
  {
    id: 'funcionamento',
    title: 'Horário de Funcionamento',
    category: 'Informações',
    tags: ['horário', 'funcionamento', 'aberto'],
    text: 'Nossos horários de atendimentos são:\nSegunda-feira: 07:30 - 18:30\nTerça-feira: 07:30 - 18:30\nQuarta-feira: 07:30 - 18:30\nQuinta-feira: 07:30 - 18:30\nSexta-feira: 07:30 - 18:30\nSábado: Fechado\nDomingo: Fechado'
  },
  {
    id: 'PREPARO',
    title: 'Preparo para Exames de Sangue e Urina',
    category: 'Informações',
    tags: ['preparo', 'jejum', 'sangue', 'urina'],
    text: 'Preparo para Exames de Sangue e Urina.\nExames de Sangue:\n- Jejum: Mínimo de 8 horas e máximo de 12 horas.\n- Hidratação: Beber água em quantidade habitual. Evitar bebidas alcoólicas 24 horas antes da coleta.\n- Alimentação: Evitar alimentos gordurosos no dia anterior ao exame.\n- Medicações: Caso faça uso de medicamentos, consulte seu médico sobre a necessidade de suspensão antes da coleta.\nExames de Urina (Coleta de Amostra) — Urina Tipo 1 (EAS) e Urocultura:\n- Fazer higiene íntima com água e sabão antes da coleta.\n- Descartar o primeiro jato de urina no vaso e coletar o jato médio no frasco estéril fornecido pelo laboratório.\n- Fechar bem o frasco e encaminhar ao laboratório em até duas horas. Caso tenha dúvidas, entre em contato com o laboratório para mais orientações! 😊'
  },

  // --- FINANCEIRO & PIX ---
  {
    id: 'Pix',
    title: 'Chave PIX (CNPJ)',
    category: 'Financeiro',
    tags: ['pix', 'pagamento', 'cnpj'],
    text: 'Laboratório LAB 💳 Nosso PIX é o CNPJ: 00.421.800/0001-86. Ficamos à disposição para qualquer dúvida!'
  },
  {
    id: 'pagamento',
    title: 'Confirmação de Pagamento com Clínica',
    category: 'Financeiro',
    tags: ['pagamento', 'comprovante', 'clínica'],
    text: 'Gostaria de verificar junto a clínica se a(o) paciente [Nome do Paciente] realizou o pagamento referente ao exame dela conosco. Poderia por gentileza confirmar se o pagamento foi realizado e solicitar o envio do comprovante para me encaminhar por gentileza.'
  },
  {
    id: 'DadosNF',
    title: 'Dados para Emissão de Nota Fiscal',
    category: 'Financeiro',
    tags: ['nota fiscal', 'nf', 'dados'],
    text: 'Me passa por favor os seguintes dados para emissão da Nota Fiscal:\nNome completo:\nCPF:\nData de nascimento:\nEmail:\nObrigada.'
  },

  // --- PESQUISAS, AVALIAÇÕES & ENCERRAMENTO ---
  {
    id: 'AvaliaçãoLAB',
    title: 'Link Avaliação Google Review',
    category: 'Pesquisas & Encerramento',
    tags: ['avaliação', 'google', 'review'],
    text: 'Olá! Seu atendimento no Laboratório LAB foi concluído com sucesso. ✅ Sua opinião é muito importante para nós! Para nos ajudar a melhorar sempre, poderia avaliar nosso atendimento? É super rápido! 👉 Clique aqui para avaliar: https://g.page/r/CeWyi-ttwJ6FEAg/review Agradecemos muito a sua preferência! 🙏'
  },
  {
    id: 'NPS',
    title: 'Pesquisa de Satisfação NPS (0 a 10)',
    category: 'Pesquisas & Encerramento',
    tags: ['nps', 'satisfação', 'nota'],
    text: 'Olá! 😊 Gostaríamos de saber como foi sua experiência com o LAB. Sua opinião é muito importante para que possamos continuar melhorando!\n👉 De 0 a 10, qual o seu grau de satisfação com o atendimento e os serviços prestados pelo nosso laboratório? (0 = Nada satisfeito | 10 = Totalmente satisfeito)\n👉 De 0 a 10, qual a chance de você indicar o nosso laboratório para um amigo ou familiar? (0 = Nunca indicaria | 10 = Indicaria com certeza)\nAgradecemos pelo seu tempo! 💙'
  },
  {
    id: 'coletadesangue',
    title: 'Pesquisa Pós Coleta de Sangue',
    category: 'Pesquisas & Encerramento',
    tags: ['coleta', 'pesquisa', 'feedback'],
    text: 'Olá, [Nome do Paciente], Esperamos que esteja bem! Gostaríamos de saber como foi sua experiência com nosso atendimento na coleta de sangue do Laboratório LAB. Sua opinião é muito importante para nós! Caso tenha alguma observação ou sugestão, fique à vontade para compartilhar. Estamos sempre em busca de oferecer o melhor serviço para você. Se precisar de algo, conte com a nossa equipe. Estamos à disposição! Atenciosamente, Equipe Laboratório LAB.'
  },
  {
    id: 'encerramento1',
    title: 'Encerramento Cordial 1',
    category: 'Pesquisas & Encerramento',
    tags: ['encerramento', 'tchau', 'disposição'],
    text: 'Nós que agradecemos! Tenha um ótimo dia e, se precisar de mais alguma coisa, saiba que estamos à disposição. 😊'
  },
  {
    id: 'encerramento2',
    title: 'Encerramento Cordial 2',
    category: 'Pesquisas & Encerramento',
    tags: ['encerramento', 'ótimo dia'],
    text: 'Tudo certo então! Qualquer dúvida, pode contar conosco. Tenha um ótimo dia!'
  },
  {
    id: 'Tarde',
    title: 'Agradecimento Boa Tarde',
    category: 'Pesquisas & Encerramento',
    tags: ['tarde', 'obrigada'],
    text: 'Muito obrigada! Excelente tarde. 😊'
  },

  // --- SOLICITAÇÕES DE CONTATO ---
  {
    id: 'Numero',
    title: 'Solicitar Número do Paciente',
    category: 'Solicitações',
    tags: ['número', 'contato', 'paciente'],
    text: 'Poderia, por gentileza, me encaminhar o número da paciente [Nome da Paciente]?'
  },
  {
    id: 'PODERIA',
    title: 'Solicitar Contato da Paciente',
    category: 'Solicitações',
    tags: ['contato', 'telefone', 'paciente'],
    text: 'Poderia, por gentileza, nos encaminhar o contato da paciente [Nome da Paciente]?'
  },
  {
    id: 'material',
    title: 'Link Formulário Material',
    category: 'Solicitações',
    tags: ['forms', 'material', 'link'],
    text: 'https://forms.gle/eRTHWsQJMDFBgZb59'
  },

  // --- CHIPS DE APRESENTACAO DA EQUIPE ---
  {
    id: '5',
    title: 'Jullya (Atendimento)',
    category: 'Atendentes',
    tags: ['jullya', 'início'],
    text: '*Atendimento LAB, Jullya 👩🏻 começou a interagir:*'
  },
  {
    id: '6',
    title: 'Vanessa (Em Treinamento)',
    category: 'Atendentes',
    tags: ['vanessa', 'início'],
    text: '*Atendimento LAB, Vanessa 👩🏽 (em treinamento) começou a interagir:*'
  },
  {
    id: '8',
    title: 'Maria (Atendimento)',
    category: 'Atendentes',
    tags: ['maria', 'início'],
    text: '*Atendimento LAB, Maria 👩🏻 começou a interagir:*'
  },
  {
    id: '7',
    title: 'Maria Eduarda (Atendimento)',
    category: 'Atendentes',
    tags: ['maria eduarda', 'início'],
    text: '*Atendimento LAB, Maria Eduarda 👩🏻‍🦱 começou a interagir:*'
  },
  {
    id: '4',
    title: 'Luanna (Atendimento)',
    category: 'Atendentes',
    tags: ['luanna', 'início'],
    text: '*Atendimento LAB, Luanna 👩🏻 começou a interagir:*'
  },
  {
    id: '0',
    title: 'Adriana Rocha (Atendimento)',
    category: 'Atendentes',
    tags: ['adriana rocha', 'início'],
    text: '*Atendimento LAB, Adriana Rocha 👩🏻 começou a interagir:*'
  },
  {
    id: 'Luis',
    title: 'Luis Felipe (Atendimento)',
    category: 'Atendentes',
    tags: ['luis felipe', 'início'],
    text: '*Atendimento LAB, Luis Felipe 🧑🏽 começou a interagir:*'
  },
  {
    id: '10',
    title: 'Louise (Atendimento)',
    category: 'Atendentes',
    tags: ['louise', 'início'],
    text: '*Atendimento LAB, Louise 👩🏾‍🦱 começou a interagir:* Ótimo dia! Tudo bem?'
  },
  {
    id: '30',
    title: 'Alexya (Atendimento)',
    category: 'Atendentes',
    tags: ['alexya', 'início'],
    text: '*Atendimento LAB, Alexya 👩🏻 começou a interagir:*'
  },
  {
    id: 'su',
    title: 'Suyanne (Em Treinamento)',
    category: 'Atendentes',
    tags: ['suyanne', 'início'],
    text: '*Atendimento LAB, Suyanne (em treinamento) 👩🏻 começou a interagir:*'
  },
  {
    id: 'jp',
    title: 'João Pedro (Em Treinamento)',
    category: 'Atendentes',
    tags: ['joão pedro', 'início'],
    text: '*Atendimento LAB, João Pedro (em treinamento) 🙋🏽‍♂️ começou a interagir:*'
  },
  {
    id: '22',
    title: 'Thainá (Atendimento)',
    category: 'Atendentes',
    tags: ['thainá', 'início'],
    text: '*Atendimento LAB, Thainá 👩🏼 começou a interagir:*'
  },
  {
    id: 'Flavia',
    title: 'Flávia Araújo (Atendimento)',
    category: 'Atendentes',
    tags: ['flávia', 'início'],
    text: '*Atendimento LAB, Flávia Araújo 👩🏽‍🦱 começou a interagir:*'
  },
  {
    id: '12',
    title: 'Adriana Soares (Em Treinamento)',
    category: 'Atendentes',
    tags: ['adriana soares', 'início'],
    text: '*Atendimento LAB, Adriana Soares 👩🏼 (em treinamento) começou a interagir:*'
  }
];

// Helper para detectar variáveis em uma string de template
function extractPlaceholders(text) {
  if (!text) return [];
  const regex = /\[(.*?)\]|(_{3,})|(-{3,})/g;
  const placeholders = [];
  const seen = new Set();
  let match;

  const ignoreList = new Set(['a', 's', 'o', 'em treinamento', '150 metros', 'ihq', 'eas', 'lgpd']);

  while ((match = regex.exec(text)) !== null) {
    let name = match[1] || match[2] || match[3];
    if (name) {
      name = name.replace(/^\[+|\]+$/g, '').trim();
      const lower = name.toLowerCase();
      if (name.length > 0 && !name.startsWith('http') && !ignoreList.has(lower) && !seen.has(name)) {
        seen.add(name);
        placeholders.push({
          rawMatch: match[0],
          name: name
        });
      }
    }
  }

  return placeholders;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QUICK_RESPONSES, extractPlaceholders };
}
