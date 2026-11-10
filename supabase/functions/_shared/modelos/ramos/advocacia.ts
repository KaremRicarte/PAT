// Ramo Advocacia: textos portados do PAT atual (bancada/index.html).
import type { Ramo } from '../tipos.ts'
import { NOME_Q_PADRAO, QUEM_PADRAO, TONS_PADRAO } from './padroes.ts'

const ramo: Ramo = {
  id: 'advocacia',
  nome: "Advocacia",
  desc: "Escritórios e advogados autônomos",
  assunto: "direitos do dia a dia",
  itens: "Áreas de atuação",
  itensQ: "Sobre quais áreas você quer falar este mês?",
  itemOne: "área",
  nomeQ: "Qual é o nome do escritório ou o seu nome profissional?",
  quem: QUEM_PADRAO,
  textOnly: true,
  noPromo: true,
  cores: {"cor1":"#B8975A","cor2":"#14213D"},
  tags: ["#advocacia","#direito"],
  ptags: {"demo":"#seusdireitos","need":"#direitonapratica","aprox":"#advocacia"},
  convite: {
    "proximo": "\"Ficou com dúvida? Mande sua mensagem para entendermos o seu caso.\"",
    "tecnico": "\"Cada caso tem detalhes próprios. Agende uma consulta para uma análise individual.\"",
    "promo": "\"Agende uma consulta pelo link da bio.\""
  },
  tons: [
    [
      "proximo",
      "Próximo e simples",
      "Sem juridiquês"
    ],
    [
      "tecnico",
      "Técnico e detalhado",
      "Com base na lei"
    ],
    [
      "promo",
      "Direto ao ponto",
      "Objetivo e formal"
    ]
  ],
  titulo: (p) => p.titulo || `O que você precisa saber sobre ${p.curto}`,
  gen: (nome: string, c: string) => ({titulo:`O que você precisa saber sobre ${c}`, gancho:`Você conhece seus direitos em ${c}?`, demo:`Explicar em linguagem simples os pontos principais de ${c}.`, beneficio:'Informação clara ajuda a tomar decisões com mais segurança.', dor:'Perder um direito por falta de informação', dorG:'Já deixou de buscar um direito por achar que não valia a pena?', dorT:'Muitos direitos têm prazo. Esperar demais pode fazer você perdê-los.', sol:`Explicar os prazos e os cuidados mais comuns em ${c}.`}),
  lib: [
    {
      "k": "trabalhista",
      "nome": "Direito trabalhista",
      "cat": "Trabalhista",
      "curto": "direito trabalhista",
      "titulo": "Foi demitido? Saiba o que conferir",
      "gancho": "Você sabe o que precisa receber quando é demitido?",
      "demo": "Explicar, em linguagem simples, as verbas da rescisão: saldo de salário, férias, 13º e FGTS.",
      "beneficio": "Conhecer seus direitos ajuda a conferir a rescisão com segurança.",
      "dor": "Horas extras que nunca aparecem no holerite",
      "dorG": "Trabalha além do horário e isso não aparece no seu pagamento?",
      "dorT": "Horas extras sem registro estão entre as dúvidas trabalhistas mais comuns.",
      "sol": "Explicar como guardar registros do horário e quando buscar orientação."
    },
    {
      "k": "família",
      "nome": "Direito de família",
      "cat": "Família",
      "curto": "direito de família",
      "titulo": "Divórcio: quais são os caminhos possíveis?",
      "gancho": "Divórcio precisa sempre ir para a Justiça?",
      "demo": "Explicar a diferença entre o divórcio em cartório e o judicial, e quando cada um é possível.",
      "beneficio": "Entender as opções ajuda a decidir com mais tranquilidade.",
      "dor": "Pensão alimentícia: dúvidas comuns",
      "dorG": "Não sabe como funciona o pedido ou a revisão da pensão?",
      "dorT": "Mudanças na renda ou nas necessidades dos filhos podem justificar a revisão do valor.",
      "sol": "Explicar quando é possível pedir a revisão e quais documentos reunir."
    },
    {
      "k": "consumidor",
      "nome": "Direito do consumidor",
      "cat": "Consumidor",
      "curto": "direito do consumidor",
      "titulo": "Comprou e deu problema? Conheça seus direitos",
      "gancho": "O produto chegou com defeito. E agora?",
      "demo": "Explicar os prazos para reclamar de defeito e o direito de arrependimento nas compras online.",
      "beneficio": "Saber os prazos evita perder um direito por falta de informação.",
      "dor": "Cobrança indevida na fatura",
      "dorG": "Apareceu uma cobrança que você não reconhece?",
      "dorT": "Cobranças indevidas são comuns e muita gente paga sem questionar.",
      "sol": "Explicar o passo a passo para contestar e guardar os comprovantes."
    },
    {
      "k": "previdenci",
      "nome": "Direito previdenciário",
      "cat": "Previdenciário",
      "curto": "aposentadoria",
      "titulo": "Aposentadoria: o que saber antes de pedir",
      "gancho": "Você sabe quanto tempo de contribuição já tem?",
      "demo": "Explicar como consultar o extrato do CNIS e por que conferir os vínculos antes de pedir a aposentadoria.",
      "beneficio": "Conferir antes evita surpresas e pedidos negados.",
      "dor": "Benefício negado pelo INSS",
      "dorG": "Teve um benefício negado e não entendeu o motivo?",
      "dorT": "Documentos faltando e vínculos sem registro estão entre os motivos mais comuns de negativa.",
      "sol": "Explicar como entender a carta de indeferimento e os próximos passos possíveis."
    },
    {
      "k": "inventário",
      "nome": "Inventário e herança",
      "cat": "Sucessões",
      "curto": "inventário",
      "titulo": "Inventário: por onde começar?",
      "gancho": "Perdeu um familiar e não sabe o que fazer com os bens?",
      "demo": "Explicar a diferença entre o inventário em cartório e o judicial, e os primeiros documentos.",
      "beneficio": "Informação clara num momento difícil.",
      "dor": "O prazo do inventário",
      "dorG": "Sabia que existe prazo para abrir o inventário?",
      "dorT": "A demora para abrir o inventário pode gerar multa sobre o imposto, conforme a lei de cada estado.",
      "sol": "Explicar o prazo e a importância de começar com orientação."
    },
    {
      "k": "imobili",
      "nome": "Direito imobiliário",
      "cat": "Imobiliário",
      "curto": "direito imobiliário",
      "titulo": "Antes de comprar um imóvel, confira isto",
      "gancho": "Vai comprar um imóvel? Já conferiu a matrícula?",
      "demo": "Explicar o que é a matrícula do imóvel e as certidões que ajudam a evitar problemas na compra.",
      "beneficio": "Uma compra mais segura começa pelos documentos.",
      "dor": "Contrato de aluguel com cláusulas abusivas",
      "dorG": "Assinou o contrato de aluguel sem ler todas as cláusulas?",
      "dorT": "Multas, reajustes e responsabilidades mal definidas viram conflito no fim do contrato.",
      "sol": "Explicar os pontos do contrato que merecem atenção antes de assinar."
    },
    {
      "k": "empresarial",
      "nome": "Direito empresarial",
      "cat": "Empresarial",
      "curto": "direito empresarial",
      "titulo": "Vai abrir uma empresa com sócio? Leia antes",
      "gancho": "Sociedade sem contrato bem-feito é um risco?",
      "demo": "Explicar o que o contrato social e o acordo de sócios devem prever: entrada, saída e divisão de lucros.",
      "beneficio": "Regras claras desde o início protegem a empresa e a relação entre os sócios.",
      "dor": "Briga de sócios sem regra definida",
      "dorG": "Um sócio quer sair e ninguém sabe como fica a empresa?",
      "dorT": "Sem regras para a saída de sócios, o conflito pode paralisar o negócio.",
      "sol": "Explicar como o acordo de sócios evita esse tipo de impasse."
    },
    {
      "k": "contrato",
      "nome": "Análise de contratos",
      "cat": "Contratos",
      "curto": "análise de contratos",
      "titulo": "Por que ler o contrato com atenção antes de assinar",
      "gancho": "Você lê tudo antes de assinar um contrato?",
      "demo": "Mostrar as cláusulas que mais geram dúvida: multa, prazo, rescisão e foro.",
      "beneficio": "Entender o que você assina evita surpresas depois.",
      "dor": "Multa de rescisão que ninguém explicou",
      "dorG": "Quis cancelar um contrato e descobriu uma multa enorme?",
      "dorT": "Cláusulas de multa e fidelidade costumam passar despercebidas na hora de assinar.",
      "sol": "Explicar como identificar essas cláusulas antes de assinar."
    }
  ],
  aprox: [
    {
      "tema": "Bastidores",
      "fmt": "Stories",
      "poll": [
        "Interessante",
        "Quero saber mais"
      ],
      "t": "Bastidores: um dia no escritório",
      "f": [
        [
          "Gancho",
          "\"Você imagina como é a rotina de um escritório de advocacia?\""
        ],
        [
          "Conteúdo",
          "Mostrar a mesa, os livros e a preparação de uma reunião sobre {prod}, sem mostrar documentos de clientes."
        ],
        [
          "Conexão",
          "\"Cada caso começa com muito estudo.\""
        ],
        [
          "Convite",
          "Enquete: \"Curtiu ver?\" Interessante / Quero saber mais"
        ]
      ]
    },
    {
      "tema": "Direito em 1 minuto",
      "fmt": "Reels",
      "t": "Direito em 1 minuto: você sabia?",
      "f": [
        [
          "Gancho",
          "\"Isso pode estar acontecendo com você e você nem sabe.\""
        ],
        [
          "Conteúdo",
          "Explicar em um minuto um direito pouco conhecido ligado a {prod}, em linguagem simples."
        ],
        [
          "Conexão",
          "\"Informação jurídica deveria ser fácil de entender.\""
        ],
        [
          "Convite",
          "\"Salva e compartilha com quem precisa saber.\""
        ]
      ]
    },
    {
      "tema": "Pergunta aos seguidores",
      "fmt": "Stories",
      "poll": [
        "Trabalho",
        "Consumidor",
        "Família"
      ],
      "t": "Enquete: que tema jurídico você quer entender?",
      "f": [
        [
          "Gancho",
          "\"Me ajuda a escolher o próximo conteúdo.\""
        ],
        [
          "Conteúdo",
          "Enquete com os temas: trabalho, consumidor e família."
        ],
        [
          "Conexão",
          "O tema mais votado vira o próximo post."
        ],
        [
          "Convite",
          "\"Vota que eu explico.\""
        ]
      ]
    },
    {
      "tema": "Mito ou verdade",
      "fmt": "Carrossel",
      "t": "Mito ou verdade: dúvidas jurídicas comuns",
      "f": [
        [
          "Gancho",
          "\"Contrato verbal não vale nada? Mito.\""
        ],
        [
          "Conteúdo",
          "Um slide por dúvida, com a resposta curta e o lembrete de que cada caso precisa de análise."
        ],
        [
          "Conexão",
          "\"Muita gente perde direitos por acreditar nesses mitos.\""
        ],
        [
          "Convite",
          "\"Qual dúvida você quer ver no próximo? Comenta aqui.\""
        ]
      ]
    },
    {
      "tema": "Glossário",
      "fmt": "Post",
      "t": "Palavra do Direito: o que significa?",
      "f": [
        [
          "Gancho",
          "\"Já ouviu um termo jurídico e ficou sem entender?\""
        ],
        [
          "Conteúdo",
          "Explicar um termo comum, como liminar ou trânsito em julgado, em palavras simples."
        ],
        [
          "Conexão",
          "Aproxima o Direito do dia a dia."
        ],
        [
          "Convite",
          "\"Que palavra você quer que eu explique?\""
        ]
      ]
    },
    {
      "tema": "Nossa trajetória",
      "fmt": "Carrossel",
      "t": "Conheça o {loja}",
      "f": [
        [
          "Gancho",
          "\"Por trás de cada atendimento, uma história.\""
        ],
        [
          "Conteúdo",
          "A formação, as áreas de atuação e os valores que guiam o trabalho."
        ],
        [
          "Conexão",
          "Mostra quem está por trás do escritório."
        ],
        [
          "Convite",
          "\"Ficou com alguma dúvida? Mande sua mensagem.\""
        ]
      ]
    },
    {
      "tema": "Caixinha de perguntas",
      "fmt": "Stories",
      "poll": [
        "Escreva sua pergunta…"
      ],
      "t": "Caixinha: dúvidas jurídicas",
      "f": [
        [
          "Gancho",
          "\"Tem dúvida sobre seus direitos?\""
        ],
        [
          "Conteúdo",
          "Caixinha aberta o dia todo. As respostas gerais saem nos Stories, sem expor ninguém."
        ],
        [
          "Conexão",
          "Mostra disponibilidade e conhecimento, sem prometer resultado."
        ],
        [
          "Convite",
          "\"Pode perguntar. Respondo as dúvidas mais comuns.\""
        ]
      ]
    },
    {
      "tema": "Equipe",
      "fmt": "Post",
      "t": "Quem cuida do seu caso",
      "f": [
        [
          "Gancho",
          "\"Prazer, esta é a equipe do escritório.\""
        ],
        [
          "Conteúdo",
          "Foto da equipe, com a área de atuação de cada um."
        ],
        [
          "Conexão",
          "Os clientes passam a conhecer quem os atende."
        ],
        [
          "Convite",
          "\"Agende uma conversa para entender o seu caso.\""
        ]
      ]
    }
  ],
}

export default ramo
