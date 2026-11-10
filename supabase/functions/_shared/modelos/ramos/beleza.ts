// Ramo Beleza e bem-estar: textos portados do PAT atual (bancada/index.html).
import type { Ramo } from '../tipos.ts'
import { NOME_Q_PADRAO, QUEM_PADRAO, TONS_PADRAO } from './padroes.ts'

const ramo: Ramo = {
  id: 'beleza',
  nome: "Beleza e bem-estar",
  desc: "Salões, estética, unhas e spa",
  assunto: "beleza e autocuidado",
  itens: "Serviços",
  itensQ: "Quais serviços você quer divulgar este mês?",
  itemOne: "serviço",
  nomeQ: NOME_Q_PADRAO,
  quem: "a cliente",
  textOnly: false,
  noPromo: false,
  cores: {"cor1":"#B76E79","cor2":"#F6EFEA"},
  tags: ["#beleza","#autocuidado"],
  ptags: {"demo":"#bemestar","need":"#dicadebeleza","aprox":"#bastidores"},
  convite: {
    "proximo": "\"Bora cuidar de você? Agende seu horário!\"",
    "tecnico": "\"Quer saber qual tratamento combina com você? Agende uma avaliação.\"",
    "promo": "\"Horários limitados nesta condição. Agende pelo WhatsApp.\""
  },
  tons: TONS_PADRAO,
  titulo: (p) => p.titulo || `Por que fazer ${p.curto}?`,
  gen: (nome: string, c: string) => ({titulo:`Por que fazer ${c}?`, gancho:`Já pensou em se dar ${c} de presente?`, demo:`Mostrar ${c} passo a passo, do começo ao resultado.`, beneficio:'Um cuidado feito por quem entende, no seu tempo.', dor:'Cuidado adiado vira cansaço', dorG:'Faz quanto tempo que você não separa um tempo para você?', dorT:'Na correria, o autocuidado é sempre o primeiro a ficar para depois.', sol:`Mostrar ${c} como um momento só seu.`}),
  lib: [
    {
      "k": "manicure",
      "nome": "Manicure e pedicure",
      "cat": "Unhas",
      "curto": "manicure e pedicure",
      "titulo": "Unhas bem-feitas mudam o seu dia",
      "gancho": "Sabe aquela sensação de olhar para as mãos e se sentir pronta?",
      "demo": "Mostrar o passo a passo: cutícula, base, esmalte e o acabamento com brilho.",
      "beneficio": "Unhas cuidadas por mais tempo, com material esterilizado e acabamento caprichado.",
      "dor": "Esmalte descascando em dois dias?",
      "dorG": "Fez a unha em casa e no dia seguinte já estava descascando?",
      "dorT": "Sem a base certa e a cutícula bem preparada, o esmalte não fixa e lasca rápido.",
      "sol": "Mostrar a preparação da unha e a base que faz o esmalte durar mais."
    },
    {
      "k": "limpeza de pele",
      "nome": "Limpeza de pele profunda",
      "cat": "Estética facial",
      "curto": "limpeza de pele",
      "titulo": "Por que fazer limpeza de pele com profissional?",
      "gancho": "Sua pele está pedindo uma pausa?",
      "demo": "Mostrar as etapas: higienização, esfoliação, extração e máscara calmante.",
      "beneficio": "Pele com sensação de limpeza e frescor, com o cuidado certo para o seu tipo de pele.",
      "dor": "Espremer cravo em casa piora a pele",
      "dorG": "Já espremeu um cravo e ficou com a marca por semanas?",
      "dorT": "Sem técnica e higiene, a extração pode inflamar e deixar manchas.",
      "sol": "Mostrar a extração feita com técnica, luvas e produtos adequados."
    },
    {
      "k": "massagem",
      "nome": "Massagem relaxante",
      "cat": "Bem-estar",
      "curto": "massagem relaxante",
      "titulo": "Uma hora só sua: por que fazer massagem relaxante?",
      "gancho": "Quando foi a última vez que você parou de verdade?",
      "demo": "Mostrar a sala preparada, a luz baixa, os óleos e o começo da sessão.",
      "beneficio": "Um momento para desacelerar e aliviar a tensão do dia a dia.",
      "dor": "Ombro travado no fim do dia?",
      "dorG": "Chega a noite e o pescoço e os ombros parecem pedra?",
      "dorT": "Horas no celular e no computador acumulam uma tensão que a gente só percebe quando dói.",
      "sol": "Mostrar a massagem focada em pescoço e ombros e a cliente saindo leve."
    },
    {
      "k": "sobrancelha",
      "nome": "Design de sobrancelhas",
      "cat": "Olhar",
      "curto": "design de sobrancelhas",
      "titulo": "O que muda com um design de sobrancelhas?",
      "gancho": "Você sabia que a sobrancelha emoldura todo o rosto?",
      "demo": "Mostrar o mapeamento do rosto, a marcação e o antes e depois.",
      "beneficio": "Um desenho pensado para o seu rosto, que valoriza o olhar com naturalidade.",
      "dor": "Sobrancelha feita em casa ficou torta?",
      "dorG": "Tirou um pelinho a mais e a sobrancelha ficou falhada?",
      "dorT": "Sem medir o rosto, é fácil tirar demais e esperar semanas para crescer de novo.",
      "sol": "Mostrar a medição com linha e o desenho respeitando o formato natural."
    },
    {
      "k": "hidrata",
      "nome": "Hidratação capilar",
      "cat": "Cabelo",
      "curto": "hidratação capilar",
      "titulo": "Por que seu cabelo precisa de hidratação?",
      "gancho": "Cabelo sem brilho e com frizz mesmo depois de lavar?",
      "demo": "Mostrar a aplicação da máscara, o tempo de pausa e a finalização com escova.",
      "beneficio": "Fios com mais maciez, brilho e menos frizz.",
      "dor": "Chapinha todo dia cobra o preço",
      "dorG": "Seu cabelo anda áspero e quebrando nas pontas?",
      "dorT": "Calor, química e sol ressecam os fios e deixam o cabelo opaco.",
      "sol": "Mostrar o cronograma de hidratação indicado para cada tipo de fio."
    },
    {
      "k": "maquiagem",
      "nome": "Maquiagem para eventos",
      "cat": "Maquiagem",
      "curto": "maquiagem para eventos",
      "titulo": "Maquiagem profissional: vale a pena para o seu evento?",
      "gancho": "Tem festa chegando e você já pensou na make?",
      "demo": "Mostrar a preparação da pele, a make pronta e as fotos com luz natural.",
      "beneficio": "Uma make que combina com você e dura a festa inteira.",
      "dor": "Make que derrete no meio da festa",
      "dorG": "Já se olhou no espelho no meio da festa e a make tinha sumido?",
      "dorT": "Sem preparação da pele e produtos de fixação, a maquiagem não aguenta calor nem horas de festa.",
      "sol": "Mostrar a preparação e a fixação que fazem a make durar."
    },
    {
      "k": "drenagem",
      "nome": "Drenagem linfática",
      "cat": "Corporal",
      "curto": "drenagem linfática",
      "titulo": "Drenagem linfática: como é a sessão?",
      "gancho": "Sensação de corpo pesado no fim do dia?",
      "demo": "Mostrar os movimentos suaves e ritmados da drenagem e explicar como é a sessão.",
      "beneficio": "Uma sensação de leveza e bem-estar, com uma técnica suave.",
      "dor": "Pernas pesadas depois de um dia em pé?",
      "dorG": "Termina o dia com as pernas cansadas e pesadas?",
      "dorT": "Passar muitas horas sentada ou em pé deixa a sensação de inchaço e cansaço.",
      "sol": "Mostrar a sessão de drenagem e explicar quando procurar uma avaliação."
    },
    {
      "k": "cílios",
      "nome": "Extensão de cílios",
      "cat": "Olhar",
      "curto": "extensão de cílios",
      "titulo": "Extensão de cílios: o que você precisa saber",
      "gancho": "Acordar já com o olhar pronto?",
      "demo": "Mostrar a aplicação fio a fio e o resultado com os olhos abertos e fechados.",
      "beneficio": "Olhar marcante sem rímel, com o volume escolhido para você.",
      "dor": "Cílios caindo depois da extensão?",
      "dorG": "Fez extensão e seus cílios naturais ficaram fracos?",
      "dorT": "Fio pesado demais ou cola aplicada do jeito errado podem danificar os cílios naturais.",
      "sol": "Mostrar a escolha do fio certo e o cuidado com os cílios naturais."
    }
  ],
  aprox: [
    {
      "tema": "Bastidores",
      "fmt": "Stories",
      "poll": [
        "Amei!",
        "Quero agendar"
      ],
      "t": "Bastidores: preparando o espaço para te receber",
      "f": [
        [
          "Gancho",
          "\"Antes de você chegar, tem todo um cuidado...\""
        ],
        [
          "Conteúdo",
          "Mostrar a esterilização dos materiais, as toalhas limpas e a sala sendo preparada para {prod}."
        ],
        [
          "Conexão",
          "\"Cuidar de você começa antes do atendimento.\""
        ],
        [
          "Convite",
          "Enquete: \"O que achou?\" Amei! / Quero agendar"
        ]
      ]
    },
    {
      "tema": "Dica da profissional",
      "fmt": "Reels",
      "t": "Dica: 3 cuidados para manter o resultado em casa",
      "f": [
        [
          "Gancho",
          "\"Fez o procedimento? Agora o resultado depende disso.\""
        ],
        [
          "Conteúdo",
          "A profissional mostra três cuidados simples para fazer em casa depois de {prod}."
        ],
        [
          "Conexão",
          "\"É a pergunta que mais ouço por aqui.\""
        ],
        [
          "Convite",
          "\"Salva para lembrar depois.\""
        ]
      ]
    },
    {
      "tema": "Pergunta às seguidoras",
      "fmt": "Stories",
      "poll": [
        "Cabelo",
        "Pele",
        "Unhas"
      ],
      "t": "Enquete: qual cuidado você mais adia?",
      "f": [
        [
          "Gancho",
          "\"Seja sincera...\""
        ],
        [
          "Conteúdo",
          "Enquete com as opções: cabelo, pele e unhas."
        ],
        [
          "Conexão",
          "A opção mais votada vira o tema da próxima dica."
        ],
        [
          "Convite",
          "\"Vota aí que a dica vem amanhã.\""
        ]
      ]
    },
    {
      "tema": "Mitos e verdades",
      "fmt": "Carrossel",
      "t": "Mitos e verdades sobre cuidados com a pele",
      "f": [
        [
          "Gancho",
          "\"Lavar o rosto com água quente faz bem? Nem sempre.\""
        ],
        [
          "Conteúdo",
          "Um slide por mito, com a explicação simples da profissional."
        ],
        [
          "Conexão",
          "\"Informação boa também é cuidado.\""
        ],
        [
          "Convite",
          "\"Marca aquela amiga que precisa ver isso.\""
        ]
      ]
    },
    {
      "tema": "Dia a dia",
      "fmt": "Reels",
      "t": "Um dia no nosso espaço",
      "f": [
        [
          "Gancho",
          "\"Vem ver como é um dia por aqui.\""
        ],
        [
          "Conteúdo",
          "Cenas rápidas: o café pronto, a primeira cliente chegando, {prod} acontecendo e o espelho no final."
        ],
        [
          "Conexão",
          "\"Aqui cada atendimento tem o seu tempo.\""
        ],
        [
          "Convite",
          "\"Qual horário combina mais com você? Conta aqui.\""
        ]
      ]
    },
    {
      "tema": "Nossa história",
      "fmt": "Carrossel",
      "t": "Como o {loja} nasceu",
      "f": [
        [
          "Gancho",
          "\"Tudo começou com um sonho e uma cadeira.\""
        ],
        [
          "Conteúdo",
          "Fotos do começo, da primeira cliente e do espaço hoje."
        ],
        [
          "Conexão",
          "\"Muitas clientes estão com a gente desde o início.\""
        ],
        [
          "Convite",
          "\"Desde quando você conhece a gente? Conta aqui.\""
        ]
      ]
    },
    {
      "tema": "Caixinha de perguntas",
      "fmt": "Stories",
      "poll": [
        "Escreva sua pergunta…"
      ],
      "t": "Caixinha: tire sua dúvida de beleza",
      "f": [
        [
          "Gancho",
          "\"Dúvida de beleza? Pergunta pra mim.\""
        ],
        [
          "Conteúdo",
          "Caixinha aberta o dia todo. As respostas saem em vídeo curto à noite."
        ],
        [
          "Conexão",
          "Mostra a profissional como quem orienta, não só como quem atende."
        ],
        [
          "Convite",
          "\"Manda sua pergunta, sem vergonha.\""
        ]
      ]
    },
    {
      "tema": "Equipe",
      "fmt": "Post",
      "t": "Conheça quem cuida de você",
      "f": [
        [
          "Gancho",
          "\"Prazer, essa é a mão por trás do seu resultado.\""
        ],
        [
          "Conteúdo",
          "Foto da profissional no espaço, com a especialidade e uma frase sobre o trabalho."
        ],
        [
          "Conexão",
          "As clientes passam a chamar a profissional pelo nome."
        ],
        [
          "Convite",
          "\"Agende seu horário e venha conhecer.\""
        ]
      ]
    }
  ],
}

export default ramo
