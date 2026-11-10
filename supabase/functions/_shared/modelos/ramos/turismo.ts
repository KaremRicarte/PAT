// Ramo Turismo: textos portados do PAT atual (bancada/index.html).
import type { Ramo } from '../tipos.ts'
import { NOME_Q_PADRAO, QUEM_PADRAO, TONS_PADRAO } from './padroes.ts'

const ramo: Ramo = {
  id: 'turismo',
  nome: "Turismo",
  desc: "Agências, pousadas e passeios",
  assunto: "viagens",
  itens: "Pacotes e passeios",
  itensQ: "Quais pacotes e passeios você quer vender este mês?",
  itemOne: "pacote",
  nomeQ: NOME_Q_PADRAO,
  quem: QUEM_PADRAO,
  textOnly: false,
  noPromo: false,
  cores: {"cor1":"#1FA3B8","cor2":"#0F2233"},
  tags: ["#viagem","#turismo"],
  ptags: {"demo":"#destinosincriveis","need":"#planejamentodeviagem","aprox":"#bastidores"},
  convite: {
    "proximo": "\"Quer montar essa viagem do seu jeito? Chama nossa equipe!\"",
    "tecnico": "\"Datas, valores e o que está incluso: nossa equipe explica tudo.\"",
    "promo": "\"Vagas limitadas nessa condição. Chama no WhatsApp.\""
  },
  tons: TONS_PADRAO,
  titulo: (p) => p.titulo || `Por que conhecer ${p.curto}?`,
  gen: (nome: string, c: string) => ({gancho:`Já pensou em viver ${c}?`, demo:`Mostrar os melhores momentos de ${c}: a chegada, a experiência e o rosto de quem está curtindo.`, beneficio:'Uma experiência organizada, sem se preocupar com os detalhes.', dor:'Viagem sem planejamento sai mais cara', dorG:'Deixou tudo para a última hora e pagou mais caro?', dorT:'Comprar perto da data costuma custar mais e limita as opções.', sol:`Mostrar ${c} com tudo organizado e as condições de pagamento.`}),
  lib: [
    {
      "k": "porto",
      "nome": "Pacote Porto de Galinhas 5 dias",
      "cat": "Pacote",
      "curto": "Porto de Galinhas",
      "titulo": "Por que Porto de Galinhas precisa estar na sua lista?",
      "gancho": "Já imaginou nadar com peixinhos numa piscina natural?",
      "demo": "Mostrar a jangada chegando às piscinas naturais na maré baixa e os peixes ao redor dos pés.",
      "beneficio": "Água morna e clara quase o ano todo, ótima para ir com crianças.",
      "dor": "Maré errada estraga o passeio às piscinas naturais",
      "dorG": "Chegou nas piscinas naturais e estava tudo coberto de água?",
      "dorT": "As piscinas só aparecem na maré baixa. Quem vai sem olhar a tábua de marés perde o passeio.",
      "sol": "Mostrar o roteiro do pacote já montado conforme a maré."
    },
    {
      "k": "gramado",
      "nome": "Pacote Gramado no Natal",
      "cat": "Pacote",
      "curto": "Gramado no Natal",
      "titulo": "Por que viver o Natal em Gramado pelo menos uma vez?",
      "gancho": "Que tal um Natal com cara de filme?",
      "demo": "Mostrar as ruas iluminadas, a decoração e uma xícara de chocolate quente na mão.",
      "beneficio": "Clima de serra e programação especial para toda a família.",
      "dor": "Deixar Gramado para a última hora sai caro",
      "dorG": "Procurou hotel em Gramado em dezembro e só achou preço alto?",
      "dorT": "No fim do ano a procura sobe e as melhores opções esgotam cedo.",
      "sol": "Mostrar o pacote com hotel e passeios já garantidos."
    },
    {
      "k": "catamar",
      "nome": "Passeio de catamarã",
      "cat": "Passeio",
      "curto": "o passeio de catamarã",
      "titulo": "Por que fazer o passeio de catamarã?",
      "gancho": "Sol, mar e música ao vivo no mesmo passeio?",
      "demo": "Mostrar a saída do píer, o mergulho na parada e o pôr do sol no barco.",
      "beneficio": "Um dia inteiro de diversão sem dirigir nem organizar nada.",
      "dor": "Passeio barato demais pode sair caro",
      "dorG": "Fechou passeio com desconhecido e ficou sem barco no dia?",
      "dorT": "Passeios informais podem não ter seguro, colete nem horário garantido.",
      "sol": "Mostrar o barco regularizado, os coletes e a equipe que acompanha."
    },
    {
      "k": "day use",
      "nome": "Day use em resort",
      "cat": "Passeio",
      "curto": "um day use em resort",
      "titulo": "Por que fazer um day use em resort?",
      "gancho": "Um dia de resort sem pagar a diária?",
      "demo": "Mostrar a piscina, o almoço incluso e as crianças no toboágua.",
      "beneficio": "Lazer completo para a família em um só dia.",
      "dor": "Mais um fim de semana sem programa?",
      "dorG": "Mais um sábado em casa sem saber o que fazer com as crianças?",
      "dorT": "Sem um plano, o descanso vira mais um dia de rotina.",
      "sol": "Mostrar o day use com transporte saindo da cidade."
    },
    {
      "k": "trilha",
      "nome": "Trilha guiada na Chapada",
      "cat": "Passeio",
      "curto": "a trilha guiada",
      "titulo": "Por que fazer trilha com guia na Chapada?",
      "gancho": "Você teria coragem de entrar nessa cachoeira?",
      "demo": "Mostrar o grupo caminhando, o guia explicando a trilha e a chegada à cachoeira.",
      "beneficio": "Segurança e histórias do lugar que você não descobre sozinho.",
      "dor": "Trilha sem guia é risco",
      "dorG": "Já se perdeu numa trilha achando que era fácil?",
      "dorT": "Trilhas mudam com a chuva, e sem sinal de celular fica difícil pedir ajuda.",
      "sol": "Mostrar o guia credenciado com kit de primeiros socorros e rádio."
    },
    {
      "k": "cruzeiro",
      "nome": "Cruzeiro pela costa brasileira",
      "cat": "Cruzeiro",
      "curto": "um cruzeiro pela costa",
      "titulo": "Por que fazer um cruzeiro pela costa?",
      "gancho": "Várias praias numa viagem só, sem fazer e desfazer mala?",
      "demo": "Mostrar a cabine, o restaurante e a parada em uma praia diferente.",
      "beneficio": "Hospedagem, comida e lazer no mesmo lugar.",
      "dor": "Viagem com muita troca de hotel cansa",
      "dorG": "Cansou de fazer check-in e check-out todo dia na viagem?",
      "dorT": "Roteiros com muitos deslocamentos tiram o tempo que seria de descanso.",
      "sol": "Mostrar o roteiro do cruzeiro com as paradas e a cabine fixa."
    },
    {
      "k": "buggy",
      "nome": "Passeio de buggy nas dunas",
      "cat": "Passeio",
      "curto": "o passeio de buggy",
      "titulo": "Por que fazer o passeio de buggy nas dunas?",
      "gancho": "Com emoção ou sem emoção?",
      "demo": "Mostrar o buggy subindo e descendo as dunas e a parada na lagoa.",
      "beneficio": "Paisagens que só dá para ver nesse passeio.",
      "dor": "Buggy sem credencial é cilada",
      "dorG": "Pegou o primeiro bugueiro que apareceu na praia?",
      "dorT": "Bugueiros sem credencial podem não ter seguro nem conhecer as áreas permitidas.",
      "sol": "Mostrar o bugueiro credenciado e o seguro do passeio."
    },
    {
      "k": "réveillon",
      "nome": "Pacote Réveillon na praia",
      "cat": "Pacote",
      "curto": "o Réveillon na praia",
      "titulo": "Por que passar o Réveillon na praia?",
      "gancho": "Onde você quer estar quando o ano virar?",
      "demo": "Mostrar a queima de fogos na praia e a ceia no hotel.",
      "beneficio": "Ano novo com o pé na areia e tudo organizado.",
      "dor": "Réveillon de última hora custa mais",
      "dorG": "Deixou para fechar a virada do ano em dezembro?",
      "dorT": "Voos e hotéis para a virada esgotam cedo e o preço sobe perto da data.",
      "sol": "Mostrar o pacote Réveillon com as condições de pagamento."
    }
  ],
  aprox: [
    {
      "tema": "Bastidores",
      "fmt": "Stories",
      "poll": [
        "Eu iria!",
        "Já tô indo"
      ],
      "t": "Bastidores: a equipe testou o passeio antes de vender",
      "f": [
        [
          "Gancho",
          "\"A gente foi antes de você!\""
        ],
        [
          "Conteúdo",
          "Vídeos curtos da equipe fazendo {prod}, com as primeiras impressões."
        ],
        [
          "Conexão",
          "\"Só indicamos o que a gente conhece de perto.\""
        ],
        [
          "Convite",
          "Enquete: \"Você iria?\" Eu iria! / Já tô indo"
        ]
      ]
    },
    {
      "tema": "Dica da equipe",
      "fmt": "Reels",
      "t": "Dica da equipe: o que não pode faltar na mala de praia",
      "f": [
        [
          "Gancho",
          "\"Esqueceu disso e a viagem ficou mais cara.\""
        ],
        [
          "Conteúdo",
          "Atendente monta a mala mostrando protetor solar, saída de praia, garrafinha e remédios básicos."
        ],
        [
          "Conexão",
          "\"É a dúvida que mais chega no nosso WhatsApp.\""
        ],
        [
          "Convite",
          "\"Salva para a próxima viagem.\""
        ]
      ]
    },
    {
      "tema": "Pergunta aos seguidores",
      "fmt": "Stories",
      "poll": [
        "Praia",
        "Serra"
      ],
      "t": "Enquete: praia ou serra?",
      "f": [
        [
          "Gancho",
          "\"Responde rápido...\""
        ],
        [
          "Conteúdo",
          "Enquete praia ou serra e, depois, caixinha: \"qual destino você sonha conhecer?\""
        ],
        [
          "Conexão",
          "As respostas viram as próximas ofertas."
        ],
        [
          "Convite",
          "\"Vota que a gente monta o pacote.\""
        ]
      ]
    },
    {
      "tema": "Curiosidade",
      "fmt": "Carrossel",
      "t": "Curiosidade: por que o mar do Nordeste é tão quentinho?",
      "f": [
        [
          "Gancho",
          "\"Água morna quase o ano todo? Tem explicação.\""
        ],
        [
          "Conteúdo",
          "Um slide por motivo: perto da linha do Equador, correntes quentes e mar raso perto da praia."
        ],
        [
          "Conexão",
          "\"Agora você sabe por que todo mundo quer voltar.\""
        ],
        [
          "Convite",
          "\"Marca quem está precisando dessas férias.\""
        ]
      ]
    },
    {
      "tema": "Dia a dia",
      "fmt": "Reels",
      "t": "O pedido mais inusitado que já chegou na agência",
      "f": [
        [
          "Gancho",
          "\"Um cliente pediu uma praia... sem areia.\""
        ],
        [
          "Conteúdo",
          "A equipe encena o atendimento até achar a solução: {prod}."
        ],
        [
          "Conexão",
          "\"Aqui a gente acha viagem até para pedido difícil.\""
        ],
        [
          "Convite",
          "\"Qual seria o seu pedido impossível? Comenta aqui.\""
        ]
      ]
    },
    {
      "tema": "História da empresa",
      "fmt": "Carrossel",
      "t": "Como a {loja} começou",
      "f": [
        [
          "Gancho",
          "\"Tudo começou com uma viagem que deu errado...\""
        ],
        [
          "Conteúdo",
          "Fotos antigas, a primeira excursão e o destino mais vendido do primeiro ano."
        ],
        [
          "Conexão",
          "\"Muitos clientes viajam com a gente há anos.\""
        ],
        [
          "Convite",
          "\"Qual foi sua primeira viagem com a gente? Conta aqui.\""
        ]
      ]
    },
    {
      "tema": "Cliente feliz",
      "fmt": "Post",
      "t": "Cliente conta como foi a viagem",
      "f": [
        [
          "Gancho",
          "\"Foi a melhor viagem da nossa vida.\""
        ],
        [
          "Conteúdo",
          "Foto enviada por um cliente, com autorização, e um trecho da mensagem que ele mandou na volta."
        ],
        [
          "Conexão",
          "Prova real de que a viagem deu certo."
        ],
        [
          "Convite",
          "\"Quer ser o próximo? Chama no WhatsApp.\""
        ]
      ]
    },
    {
      "tema": "Equipe",
      "fmt": "Post",
      "t": "Conheça quem planeja a sua viagem",
      "f": [
        [
          "Gancho",
          "\"Esse é o rosto por trás do seu roteiro.\""
        ],
        [
          "Conteúdo",
          "Foto de um agente no destino favorito dele e uma frase sobre o trabalho."
        ],
        [
          "Conexão",
          "Clientes passam a chamar a equipe pelo nome."
        ],
        [
          "Convite",
          "\"Manda um oi e pede seu roteiro.\""
        ]
      ]
    }
  ],
}

export default ramo
