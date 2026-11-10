// Ramo Psicologia: textos portados do PAT atual (bancada/index.html).
import type { Ramo } from '../tipos.ts'
import { NOME_Q_PADRAO, QUEM_PADRAO, TONS_PADRAO } from './padroes.ts'

const ramo: Ramo = {
  id: 'psicologia',
  nome: "Psicologia",
  desc: "Consultórios e atendimento online",
  assunto: "saúde emocional",
  itens: "Atendimentos e temas",
  itensQ: "Sobre quais atendimentos você quer falar este mês?",
  itemOne: "tema",
  nomeQ: "Qual é o seu nome profissional ou o nome do consultório?",
  quem: "quem te procura",
  textOnly: true,
  noPromo: true,
  cores: {"cor1":"#7FA98F","cor2":"#F3EFE7"},
  tags: ["#psicologia","#saudemental"],
  ptags: {"demo":"#terapia","need":"#saudeemocional","aprox":"#psicologianodiaadia"},
  convite: {
    "proximo": "\"Quer conversar? Me chama para agendar uma sessão.\"",
    "tecnico": "\"Ficou com dúvida sobre como funciona o atendimento? Me pergunta.\"",
    "promo": "\"Agenda aberta para novos atendimentos. Me chama no WhatsApp.\""
  },
  tons: [
    [
      "proximo",
      "Acolhedor",
      "Próximo e gentil"
    ],
    [
      "tecnico",
      "Explicando tudo",
      "Didático e cuidadoso"
    ],
    [
      "promo",
      "Direto ao ponto",
      "Convite claro para agendar"
    ]
  ],
  titulo: (p) => p.titulo || `Vamos falar sobre ${p.curto}?`,
  gen: (nome: string, c: string) => ({titulo:`Vamos falar sobre ${c}?`, gancho:`Você já pensou em procurar ajuda para lidar com ${c}?`, demo:`Explicar com calma como a terapia pode ajudar com ${c} e como é o atendimento.`, beneficio:'Um espaço seguro e sigiloso para falar sobre o que você sente.', dor:'Adiar o cuidado emocional', dorG:'Você sempre deixa o que sente para depois?', dorT:'Guardar tudo pode pesar com o tempo. Pedir ajuda é um sinal de cuidado, não de fraqueza.', sol:`Explicar quando faz sentido procurar ajuda para lidar com ${c}.`}),
  lib: [
    {
      "k": "individual",
      "nome": "Psicoterapia individual",
      "cat": "Psicoterapia",
      "curto": "psicoterapia",
      "titulo": "Como funciona uma sessão de terapia?",
      "gancho": "Você já se perguntou o que acontece numa sessão de terapia?",
      "demo": "Explicar com calma como é a primeira sessão: a conversa, o sigilo e a frequência dos encontros.",
      "beneficio": "Um espaço seguro e sigiloso para falar sobre o que você sente, no seu tempo.",
      "dor": "Terapia é só para quem está muito mal?",
      "dorG": "Você acha que terapia é só para quando tudo desmorona?",
      "dorT": "Muita gente espera chegar ao limite. A terapia também serve para se conhecer e se cuidar antes.",
      "sol": "Explicar os vários motivos para começar a terapia, sem precisar de uma crise."
    },
    {
      "k": "online",
      "nome": "Terapia online",
      "cat": "Atendimento online",
      "curto": "terapia online",
      "titulo": "Terapia online funciona?",
      "gancho": "A falta de tempo é o que te impede de começar a terapia?",
      "demo": "Mostrar como é o atendimento online: o link, a conversa por vídeo e a privacidade.",
      "beneficio": "O mesmo cuidado e o mesmo sigilo, de onde você estiver.",
      "dor": "Sem tempo para ir ao consultório?",
      "dorG": "Já desistiu da terapia por causa do trânsito e da agenda?",
      "dorT": "Deslocamento e horários apertados fazem muita gente adiar o cuidado com a saúde emocional.",
      "sol": "Explicar como o atendimento online cabe na rotina, com sigilo e um lugar reservado."
    },
    {
      "k": "casal",
      "nome": "Terapia de casal",
      "cat": "Relacionamentos",
      "curto": "terapia de casal",
      "titulo": "Quando procurar terapia de casal?",
      "gancho": "Vocês discutem sempre pelo mesmo motivo?",
      "demo": "Explicar como funcionam as sessões a dois e o papel do psicólogo como mediador, sem tomar partido.",
      "beneficio": "Um espaço para os dois falarem e serem ouvidos.",
      "dor": "Brigas que se repetem",
      "dorG": "A conversa sempre termina em briga, mesmo quando começa bem?",
      "dorT": "Quando o diálogo vira acusação, o casal para de se ouvir e o problema real fica sem solução.",
      "sol": "Explicar como a terapia ajuda o casal a encontrar novas formas de conversar."
    },
    {
      "k": "ansiedade",
      "nome": "Acompanhamento para ansiedade",
      "cat": "Saúde emocional",
      "curto": "ansiedade",
      "titulo": "Ansiedade: quando é hora de pedir ajuda?",
      "gancho": "Coração acelerado e pensamento que não desliga?",
      "demo": "Explicar a diferença entre a ansiedade do dia a dia e a que atrapalha a rotina, e como a terapia pode ajudar.",
      "beneficio": "Entender o que você sente é o primeiro passo para cuidar disso.",
      "dor": "Ansiedade que atrapalha a rotina",
      "dorG": "Você deixa de fazer coisas por medo do que pode acontecer?",
      "dorT": "Quando a preocupação vira constante e começa a afetar o sono, o trabalho e as relações, é sinal de atenção.",
      "sol": "Explicar os sinais de alerta e quando procurar um psicólogo."
    },
    {
      "k": "adolescente",
      "nome": "Terapia para adolescentes",
      "cat": "Adolescência",
      "curto": "terapia para adolescentes",
      "titulo": "Seu filho adolescente pode precisar de terapia?",
      "gancho": "Seu filho anda mais calado e fechado no quarto?",
      "demo": "Explicar como funciona o atendimento de adolescentes, o sigilo e a participação dos pais.",
      "beneficio": "Um espaço para o adolescente falar sem julgamento.",
      "dor": "Mudanças de comportamento na adolescência",
      "dorG": "Ficou difícil conversar com seu filho?",
      "dorT": "Isolamento, irritação e queda nas notas podem ser só uma fase, mas também podem ser um pedido de ajuda.",
      "sol": "Explicar os sinais para observar e como a família pode apoiar."
    },
    {
      "k": "orientação",
      "nome": "Orientação profissional",
      "cat": "Carreira",
      "curto": "orientação profissional",
      "titulo": "Orientação profissional: para quem é?",
      "gancho": "Em dúvida sobre que carreira seguir?",
      "demo": "Explicar as etapas da orientação: interesses, habilidades e conversa sobre as opções.",
      "beneficio": "Decidir com mais clareza e menos pressão.",
      "dor": "Escolher a carreira sob pressão",
      "dorG": "Todo mundo pergunta \"e aí, vai fazer o quê?\" e você não sabe responder?",
      "dorT": "A pressão para decidir rápido faz muita gente escolher no impulso e se frustrar depois.",
      "sol": "Explicar como a orientação ajuda a decidir com calma e autoconhecimento."
    },
    {
      "k": "luto",
      "nome": "Acolhimento no luto",
      "cat": "Luto",
      "curto": "luto",
      "titulo": "Luto: não existe jeito certo de sentir",
      "gancho": "Perdeu alguém e sente que todo mundo espera que você já esteja bem?",
      "demo": "Explicar com delicadeza o que é o processo de luto e como a terapia pode acolher.",
      "beneficio": "Um lugar para viver a perda no seu tempo, com apoio.",
      "dor": "A cobrança para superar logo",
      "dorG": "Já ouviu \"já passou da hora de seguir em frente\"?",
      "dorT": "Cada pessoa vive o luto de um jeito. A cobrança dos outros pode aumentar a dor.",
      "sol": "Explicar que o luto não tem prazo e quando buscar apoio."
    },
    {
      "k": "autoestima",
      "nome": "Autoestima e autoconhecimento",
      "cat": "Autoconhecimento",
      "curto": "autoconhecimento",
      "titulo": "Autoconhecimento: por onde começar?",
      "gancho": "Você se cobra mais do que cobraria de qualquer outra pessoa?",
      "demo": "Explicar como a terapia ajuda a perceber padrões e a se tratar com mais gentileza.",
      "beneficio": "Conhecer a si mesmo para fazer escolhas mais alinhadas com quem você é.",
      "dor": "A autocrítica que não dá descanso",
      "dorG": "Erra uma coisa pequena e passa o dia se culpando?",
      "dorT": "A autocrítica excessiva desgasta e faz a gente duvidar de tudo o que faz.",
      "sol": "Explicar como reconhecer a autocrítica e começar a mudar a forma de se tratar."
    }
  ],
  aprox: [
    {
      "tema": "Bastidores",
      "fmt": "Stories",
      "poll": [
        "Aconchegante",
        "Quero conhecer"
      ],
      "t": "Bastidores: o consultório pronto para te receber",
      "f": [
        [
          "Gancho",
          "\"Esse é o lugar onde a gente conversa.\""
        ],
        [
          "Conteúdo",
          "Mostrar o consultório vazio: a poltrona, a luz, a água e os detalhes que deixam o espaço acolhedor."
        ],
        [
          "Conexão",
          "\"Cada detalhe foi pensado para você se sentir à vontade.\""
        ],
        [
          "Convite",
          "Enquete: \"O que achou?\" Aconchegante / Quero conhecer"
        ]
      ]
    },
    {
      "tema": "Autocuidado",
      "fmt": "Reels",
      "t": "Uma pausa de 1 minuto para respirar",
      "f": [
        [
          "Gancho",
          "\"Faz isso comigo agora: um minuto só.\""
        ],
        [
          "Conteúdo",
          "Guiar uma respiração simples: inspirar contando até 4, segurar até 4 e soltar até 6."
        ],
        [
          "Conexão",
          "\"Pequenas pausas também são cuidado.\""
        ],
        [
          "Convite",
          "\"Salva para usar num dia corrido.\""
        ]
      ]
    },
    {
      "tema": "Pergunta aos seguidores",
      "fmt": "Stories",
      "poll": [
        "Ansiedade",
        "Relacionamentos",
        "Autoestima"
      ],
      "t": "Enquete: sobre o que você quer ler aqui?",
      "f": [
        [
          "Gancho",
          "\"Quero te ouvir...\""
        ],
        [
          "Conteúdo",
          "Enquete com os temas: ansiedade, relacionamentos e autoestima."
        ],
        [
          "Conexão",
          "O tema mais votado vira o próximo conteúdo."
        ],
        [
          "Convite",
          "\"Vota que o próximo post é sobre isso.\""
        ]
      ]
    },
    {
      "tema": "Mitos sobre terapia",
      "fmt": "Carrossel",
      "t": "Mitos sobre terapia que afastam as pessoas",
      "f": [
        [
          "Gancho",
          "\"Terapia é coisa de louco? Não.\""
        ],
        [
          "Conteúdo",
          "Um slide por mito: só serve para crise, o psicólogo dá conselhos, demora anos. E a explicação de cada um."
        ],
        [
          "Conexão",
          "\"Informação de qualidade aproxima as pessoas do cuidado.\""
        ],
        [
          "Convite",
          "\"Compartilha com quem tem curiosidade sobre terapia.\""
        ]
      ]
    },
    {
      "tema": "Reflexão",
      "fmt": "Post",
      "t": "Descansar também é produtivo",
      "f": [
        [
          "Gancho",
          "\"Descansar também é produtivo.\""
        ],
        [
          "Conteúdo",
          "Uma frase curta para pensar, com uma explicação breve na legenda."
        ],
        [
          "Conexão",
          "Gera identificação sem expor ninguém."
        ],
        [
          "Convite",
          "\"Como está o seu descanso esta semana?\""
        ]
      ]
    },
    {
      "tema": "Minha trajetória",
      "fmt": "Carrossel",
      "t": "Por que escolhi a psicologia",
      "f": [
        [
          "Gancho",
          "\"Sempre me perguntam por que escolhi a psicologia.\""
        ],
        [
          "Conteúdo",
          "A formação, a abordagem de trabalho e o que move o atendimento no dia a dia."
        ],
        [
          "Conexão",
          "Mostra quem está do outro lado da conversa."
        ],
        [
          "Convite",
          "\"Ficou com alguma dúvida sobre o atendimento? Me pergunta.\""
        ]
      ]
    },
    {
      "tema": "Caixinha de perguntas",
      "fmt": "Stories",
      "poll": [
        "Escreva sua pergunta…"
      ],
      "t": "Caixinha: dúvidas sobre terapia",
      "f": [
        [
          "Gancho",
          "\"Tem dúvida sobre como funciona a terapia?\""
        ],
        [
          "Conteúdo",
          "Caixinha aberta o dia todo. As respostas saem nos Stories à noite, sem identificar ninguém."
        ],
        [
          "Conexão",
          "Tira o medo de quem nunca fez terapia."
        ],
        [
          "Convite",
          "\"Pode perguntar, é anônimo.\""
        ]
      ]
    },
    {
      "tema": "Como eu trabalho",
      "fmt": "Post",
      "t": "Como funciona o meu atendimento",
      "f": [
        [
          "Gancho",
          "\"Cada psicólogo tem um jeito de conduzir a terapia.\""
        ],
        [
          "Conteúdo",
          "Explicar a abordagem, a duração das sessões e se o atendimento é presencial, online ou os dois."
        ],
        [
          "Conexão",
          "Ajuda a pessoa a saber o que esperar."
        ],
        [
          "Convite",
          "\"Quer saber se faz sentido para você? Me chama.\""
        ]
      ]
    }
  ],
}

export default ramo
