// Ramo Loja de ferramentas: textos portados do PAT atual (bancada/index.html).
import type { Ramo } from '../tipos.ts'
import { NOME_Q_PADRAO, QUEM_PADRAO, TONS_PADRAO } from './padroes.ts'

const ramo: Ramo = {
  id: 'ferramentas',
  nome: "Loja de ferramentas",
  desc: "Ferragens e material de construção",
  assunto: "ferramentas e reparos",
  itens: "Produtos",
  itensQ: "Quais produtos você quer vender este mês?",
  itemOne: "produto",
  nomeQ: NOME_Q_PADRAO,
  quem: QUEM_PADRAO,
  textOnly: false,
  noPromo: false,
  cores: {"cor1":"#F2A21B","cor2":"#151925"},
  tags: ["#ferramentas","#ferragem"],
  ptags: {"demo":"#dicadeferramenta","need":"#reparoemcasa","aprox":"#bastidores"},
  convite: {
    "proximo": "\"Quer descobrir qual modelo combina com sua necessidade? Fale com nossa equipe!\"",
    "tecnico": "\"Dúvida sobre potência, voltagem ou acessório? Nossa equipe explica.\"",
    "promo": "\"Passa na loja ou chama no WhatsApp: tem condição especial esta semana.\""
  },
  tons: TONS_PADRAO,
  titulo: (p) => (p.art ? `Por que ter ${p.art} ${p.curto} em casa?` : `Por que ter ${p.curto} em casa?`),
  gen: (nome: string, c: string) => ({gancho:`Já precisou de ${c} e não tinha na hora?`, demo:`Mostrar ${c} em uso numa situação real, do começo ao resultado.`, beneficio:'A ferramenta certa economiza tempo e evita retrabalho.', dor:`O que dá errado quando se improvisa sem ${c}`, dorG:'Já tentou improvisar e o serviço ficou pior?', dorT:'Improvisar com a ferramenta errada costuma estragar material e tomar o dobro do tempo.', sol:`Mostrar ${c} resolvendo o mesmo serviço do jeito certo.`}),
  lib: [
    {
      "k": "furadeira",
      "nome": "Furadeira de impacto 650W",
      "cat": "Elétricas",
      "art": "uma",
      "curto": "furadeira",
      "gancho": "Precisou instalar uma prateleira e não tinha a ferramenta certa?",
      "demo": "Mostrar a furadeira fazendo um furo em madeira e, com o acessório adequado, parafusando uma peça.",
      "beneficio": "Uma ferramenta versátil pode facilitar pequenas montagens e reparos em casa.",
      "dor": "Bucha rodando na parede: o erro está na broca",
      "dorG": "Furou, colocou a bucha e ela ficou girando em falso?",
      "dorT": "Broca maior que a bucha, ou furo em concreto sem impacto, deixa o furo largo demais.",
      "sol": "Mostrar a furadeira no modo impacto com broca de 6 mm e a bucha 6 firme na parede."
    },
    {
      "k": "parafusadeira",
      "nome": "Parafusadeira a bateria 12V",
      "cat": "Elétricas",
      "art": "uma",
      "curto": "parafusadeira",
      "gancho": "Ainda monta móvel parafuso por parafuso na chave de fenda?",
      "demo": "Montar a lateral de um guarda-roupa em segundos, mostrando o ajuste de torque para não espanar.",
      "beneficio": "Menos esforço no punho e montagem muito mais rápida.",
      "dor": "Parafuso espanado no MDF: como evitar",
      "dorG": "O parafuso girou em falso e o MDF esfarelou?",
      "dorT": "Força demais no fim da rosca destrói o MDF e deixa a porta frouxa.",
      "sol": "Mostrar o ajuste de torque na posição baixa, travando o parafuso no ponto certo."
    },
    {
      "k": "trena",
      "nome": "Trena a laser 40 m",
      "cat": "Medição",
      "art": "uma",
      "curto": "trena a laser",
      "gancho": "Medir um cômodo sozinho ainda vira ginástica?",
      "demo": "Medir a parede de ponta a ponta com um clique e mostrar o cálculo de área no visor.",
      "beneficio": "Medida certa sem precisar de ajudante.",
      "dor": "Comprou piso a mais (ou a menos)? O problema foi a medida",
      "dorG": "Faltaram três caixas de piso no meio da obra?",
      "dorT": "Medida errada faz sobrar material ou parar a obra esperando reposição.",
      "sol": "Mostrar a trena a laser calculando os metros quadrados do cômodo em segundos."
    },
    {
      "k": "nível",
      "nome": "Nível a laser de linhas",
      "cat": "Medição",
      "art": "um",
      "curto": "nível a laser",
      "gancho": "Quadro torto na parede incomoda você também?",
      "demo": "Projetar a linha na parede e alinhar três quadros em sequência.",
      "beneficio": "Tudo alinhado na primeira tentativa, sem furo extra na parede.",
      "dor": "Prateleira torta: o problema é a referência",
      "dorG": "Mediu do teto, furou, e a prateleira ficou torta?",
      "dorT": "Teto e piso quase nunca são retos, então medir a partir deles engana.",
      "sol": "Mostrar o laser marcando uma linha reta que não depende do piso nem do teto."
    },
    {
      "k": "esmerilhadeira",
      "nome": "Esmerilhadeira angular 4½\"",
      "cat": "Elétricas",
      "art": "uma",
      "curto": "esmerilhadeira",
      "gancho": "Precisa cortar vergalhão ou piso e só tem serrinha?",
      "demo": "Cortar uma barra de ferro com disco de corte, usando óculos e luvas.",
      "beneficio": "Corte rápido e limpo, com a proteção certa.",
      "dor": "Disco errado na esmerilhadeira é risco",
      "dorG": "Você usa o mesmo disco para cortar ferro e cerâmica?",
      "dorT": "Cada material pede um disco: um para metal, outro para cerâmica e pedra.",
      "sol": "Mostrar os dois discos lado a lado e o corte limpo de cada um."
    },
    {
      "k": "chave",
      "nome": "Jogo de chaves combinadas 8–19 mm",
      "cat": "Manuais",
      "art": "um",
      "curto": "jogo de chaves combinadas",
      "gancho": "A chave inglesa vive arredondando a porca?",
      "demo": "Comparar a chave ajustável e a combinada na mesma porca de 13 mm.",
      "beneficio": "Encaixe firme, sem estragar a cabeça da porca.",
      "dor": "Porca arredondada: três erros comuns",
      "dorG": "A porca ficou redonda e agora não sai de jeito nenhum?",
      "dorT": "Chave com folga, medida errada e força no ângulo errado arredondam a porca.",
      "sol": "Mostrar a chave combinada abraçando os seis lados da porca."
    },
    {
      "k": "torneira",
      "nome": "Kit reparo para torneira",
      "cat": "Hidráulica",
      "art": "um",
      "curto": "kit reparo de torneira",
      "gancho": "Torneira pingando a noite inteira?",
      "demo": "Fechar o registro, trocar o vedante e testar, em três passos.",
      "beneficio": "Conserto rápido, sem chamar encanador para um reparo simples.",
      "dor": "Quanto custa uma torneira pingando?",
      "dorG": "Aquele pinga-pinga parece pouca coisa, né?",
      "dorT": "Um gotejamento contínuo pode desperdiçar dezenas de litros de água por dia, e isso aparece na conta.",
      "sol": "Mostrar a troca do vedante e a torneira fechando sem pingar."
    },
    {
      "k": "lavadora",
      "nome": "Lavadora de alta pressão 1400W",
      "cat": "Limpeza",
      "art": "uma",
      "curto": "lavadora de alta pressão",
      "gancho": "Calçada cheia de limo antes da visita chegar?",
      "demo": "Lavar metade de um pedaço da calçada e mostrar o antes e depois lado a lado.",
      "beneficio": "Limpeza pesada em minutos, gastando menos água que a mangueira.",
      "dor": "Limo na calçada é escorregão garantido",
      "dorG": "Alguém já escorregou na sua garagem em dia de chuva?",
      "dorT": "Limo acumula em piso com sombra e deixa a superfície lisa como sabão.",
      "sol": "Mostrar a lavadora removendo o limo em uma passada."
    }
  ],
  aprox: [
    {
      "tema": "Bastidores",
      "fmt": "Stories",
      "poll": [
        "Sim!",
        "Quero ver"
      ],
      "t": "Bastidores: chegou mercadoria nova",
      "f": [
        [
          "Gancho",
          "\"Adivinha o que chegou hoje?\""
        ],
        [
          "Conteúdo",
          "Abrir as caixas no estoque e mostrar {prod} saindo da embalagem, sem roteiro decorado."
        ],
        [
          "Conexão",
          "\"A gente confere tudo antes de ir para a prateleira.\""
        ],
        [
          "Convite",
          "Enquete: \"Quer ver funcionando?\" Sim / Quero ver"
        ]
      ]
    },
    {
      "tema": "Dica da equipe",
      "fmt": "Reels",
      "t": "Dica da equipe: qual bucha usar em cada parede",
      "f": [
        [
          "Gancho",
          "\"A bucha certa depende da parede, não do parafuso.\""
        ],
        [
          "Conteúdo",
          "Atendente mostra bucha para alvenaria, para drywall e para bloco, uma de cada vez, no balcão."
        ],
        [
          "Conexão",
          "\"É a pergunta que mais ouvimos aqui na loja.\""
        ],
        [
          "Convite",
          "\"Salva esse vídeo para a próxima vez que for furar.\""
        ]
      ]
    },
    {
      "tema": "Pergunta aos seguidores",
      "fmt": "Stories",
      "poll": [
        "Torneira pingando",
        "Porta rangendo",
        "Tomada solta"
      ],
      "t": "Enquete: qual reparo você mais adia em casa?",
      "f": [
        [
          "Gancho",
          "\"Seja sincero...\""
        ],
        [
          "Conteúdo",
          "Enquete com opções: torneira pingando, porta rangendo, tomada solta."
        ],
        [
          "Conexão",
          "O mais votado vira o tema do próximo vídeo."
        ],
        [
          "Convite",
          "\"Vota aí que a gente ensina a resolver o campeão.\""
        ]
      ]
    },
    {
      "tema": "Curiosidade",
      "fmt": "Carrossel",
      "t": "Curiosidade: por que existem tantos tipos de ponta de parafuso?",
      "f": [
        [
          "Gancho",
          "\"Fenda, Phillips, Torx, Allen... precisava de tantas?\""
        ],
        [
          "Conteúdo",
          "Um slide por ponta, com foto e o motivo de cada uma existir."
        ],
        [
          "Conexão",
          "\"Agora você já sabe qual pedir no balcão.\""
        ],
        [
          "Convite",
          "\"Marca aquele amigo que sempre pega a chave errada.\""
        ]
      ]
    },
    {
      "tema": "Dia a dia",
      "fmt": "Reels",
      "t": "O pedido mais inusitado do balcão",
      "f": [
        [
          "Gancho",
          "\"Um cliente chegou pedindo... aquele negócio que gira.\""
        ],
        [
          "Conteúdo",
          "A equipe encena a conversa do balcão até descobrir que o cliente queria {prod}."
        ],
        [
          "Conexão",
          "\"A gente entende até descrição feita com as mãos.\""
        ],
        [
          "Convite",
          "\"Já pediu alguma coisa assim? Conta aqui.\""
        ]
      ]
    },
    {
      "tema": "História da loja",
      "fmt": "Carrossel",
      "t": "Como a {loja} começou",
      "f": [
        [
          "Gancho",
          "\"Antes desse balcão, era só uma portinha...\""
        ],
        [
          "Conteúdo",
          "Fotos antigas da loja, o primeiro funcionário e o produto mais vendido do primeiro ano."
        ],
        [
          "Conexão",
          "\"Muita gente que compra hoje vinha aqui com os pais.\""
        ],
        [
          "Convite",
          "\"Você conheceu a loja antiga? Conta nos comentários.\""
        ]
      ]
    },
    {
      "tema": "Caixinha de perguntas",
      "fmt": "Stories",
      "poll": [
        "Escreva sua pergunta…"
      ],
      "t": "Caixinha: tire sua dúvida de ferramenta",
      "f": [
        [
          "Gancho",
          "\"Dúvida de ferramenta? Pergunta pra gente.\""
        ],
        [
          "Conteúdo",
          "Caixinha de perguntas aberta o dia todo. As respostas saem em vídeo curto à noite."
        ],
        [
          "Conexão",
          "Mostra a equipe como quem resolve, não só como quem vende."
        ],
        [
          "Convite",
          "\"Manda sua pergunta, até a mais básica.\""
        ]
      ]
    },
    {
      "tema": "Equipe",
      "fmt": "Post",
      "t": "Conheça quem te atende no balcão",
      "f": [
        [
          "Gancho",
          "\"Esse é o rosto por trás das suas dúvidas.\""
        ],
        [
          "Conteúdo",
          "Foto de um atendente com a ferramenta favorita e uma frase sobre o trabalho."
        ],
        [
          "Conexão",
          "Clientes passam a chamar a equipe pelo nome."
        ],
        [
          "Convite",
          "\"Passa lá e diz que viu aqui.\""
        ]
      ]
    }
  ],
}

export default ramo
