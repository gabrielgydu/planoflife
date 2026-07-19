import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Practice } from '../types'
import type { BundledText } from './bundledTexts'
import { isInActiveWindow } from '../utils/season'

// "Novena do Trabalho — a São Josemaria Escrivá", by Francisco Faus (with
// ecclesiastical approval). Prayed 17–25 June, the nine days leading to St.
// Josemaría's feast on 26 June. Each day pairs a short reflection (his own
// words) with two intentions — A for those seeking work, B for those already
// working — and closes with the prayer for his intercession.
//
// The practice carries a FIXED id + this bundledTextId so both of a user's
// devices insert the identical row and sync converges (see ADDITIONAL_PRACTICES
// and the v9 upgrade in src/db/index.ts). Visibility is driven by the
// practice's activeWindow (see src/utils/season.ts); the *content* shown is the
// specific day resolved from the viewing date below.

export const NOVENA_TRABALHO_PRACTICE_ID = 'novena-trabalho-sao-josemaria'
export const NOVENA_TRABALHO_BUNDLED_ID = 'novena_trabalho'
export const NOVENA_TRABALHO_NAME = 'Novena a São Josemaria'
export const NOVENA_TRABALHO_CATEGORY = 'Meio-dia'
export const NOVENA_TRABALHO_WINDOW = {
  startMonth: 6,
  startDay: 17,
  endMonth: 6,
  endDay: 25,
} as const

const OPENING_PRAYER =
  'Ó Deus, que por mediação da Santíssima Virgem Maria, concedestes inumeráveis ' +
  'graças a São Josemaria, sacerdote, escolhendo-o como instrumento fidelíssimo ' +
  'para fundar o Opus Dei, caminho de santificação no trabalho profissional e no ' +
  'cumprimento dos deveres cotidianos do cristão, fazei que eu saiba também ' +
  'converter todos os momentos e circunstâncias da minha vida em ocasião de Vos ' +
  'amar, e de servir com alegria e com simplicidade a Igreja, o Romano Pontífice e ' +
  'as almas, iluminando os caminhos da terra com o resplendor da fé e do amor. ' +
  'Concedei-me por intercessão de São Josemaria o favor que vos peço… *(peça-se)*. ' +
  'Assim seja.'

interface Reflection {
  quote: string
  source: string
}

interface NovenaDay {
  ordinal: string
  /** 1-indexed month/day, used to resolve the current day from the date. */
  month: number
  day: number
  dateLabel: string
  theme: string
  reflections: Reflection[]
  intentionA: string
  intentionB: string
}

const DAYS: NovenaDay[] = [
  {
    ordinal: 'Primeiro',
    month: 6,
    day: 17,
    dateLabel: '17 de junho',
    theme: 'Trabalho, caminho de santidade',
    reflections: [
      {
        quote:
          'Viemos chamar de novo a atenção para o exemplo de Jesus que, durante trinta anos, permaneceu em Nazaré trabalhando, desempenhando um ofício. Nas mãos de Jesus, o trabalho, e um trabalho profissional semelhante àquele que desenvolvem milhões de homens no mundo, converte-se em tarefa divina, em trabalho redentor, em caminho de salvação.',
        source: 'Entrevistas com Mons. Escrivá, n. 55',
      },
      {
        quote:
          'Aí onde estão os nossos irmãos, os homens, aí onde estão as nossas aspirações, o nosso trabalho, os nossos amores, aí está o lugar do nosso encontro cotidiano com Cristo. Deus nos espera cada dia: no laboratório, na sala de operações de um hospital, no quartel, na cátedra universitária, na fábrica, na oficina, no campo, no seio do lar e em todo o imenso panorama do trabalho.',
        source: 'Homilia «Amar o mundo apaixonadamente»',
      },
    ],
    intentionA:
      'Para que Deus Nosso Senhor me oriente no esforço de procurar trabalho, e me abençoe fazendo-me conseguir um emprego honesto, digno e estável; e que me ajude, depois, a olhar para a minha tarefa profissional como um caminho de santificação e de serviço aos outros, onde o meu Pai Deus me espera a toda a hora e me pede que imite Jesus quando trabalhava como carpinteiro em Nazaré.',
    intentionB:
      'Para que Deus Nosso Senhor me ajude a olhar para a minha tarefa profissional como um caminho de santificação e de serviço aos outros, onde Ele me espera a toda a hora, e me pede, em todas as circunstâncias, que imite Jesus quando trabalhava como carpinteiro em Nazaré.',
  },
  {
    ordinal: 'Segundo',
    month: 6,
    day: 18,
    dateLabel: '18 de junho',
    theme: 'Trabalhar por amor a Deus',
    reflections: [
      {
        quote:
          'A dignidade do trabalho se baseia no Amor. O grande privilégio do homem é poder amar, transcendendo assim o efêmero e transitório.',
        source: 'É Cristo que passa, n. 48',
      },
      {
        quote:
          'Fazei tudo por Amor. – Assim não há coisas pequenas: tudo é grande. – A perseverança nas pequenas coisas, por Amor, é heroísmo.',
        source: 'Caminho, n. 813',
      },
      {
        quote:
          'Na simplicidade do teu trabalho habitual, nos detalhes monótonos de cada dia, tens que descobrir o segredo – para tantos escondido – da grandeza e da novidade: o Amor.',
        source: 'Sulco, n. 489',
      },
    ],
    intentionA:
      'Para que Deus me conceda a graça de conseguir logo um trabalho, que proporcione segurança à minha família. E para que, ao mesmo tempo, Ele me ajude a compreender que o que dá valor a qualquer trabalho honesto é o amor com que o fazemos: em primeiro lugar, amor a Deus, a quem oferecemos o trabalho; e amor ao próximo, a quem queremos servir e ser úteis.',
    intentionB:
      'Para que Deus me ajude a compreender que o que dá valor a qualquer trabalho honesto é o amor com que o fazemos: em primeiro lugar, amor a Deus, a quem oferecemos o trabalho; e amor ao próximo, a quem queremos servir e ser úteis.',
  },
  {
    ordinal: 'Terceiro',
    month: 6,
    day: 19,
    dateLabel: '19 de junho',
    theme: 'Trabalhar com ordem e constância',
    reflections: [
      {
        quote:
          'Como é breve a duração da nossa passagem pela terra! … Verdadeiramente é curto o nosso tempo para amar, para dar, para desagravar. Não é justo, portanto, que o malbaratemos… Não podemos desperdiçar esta etapa do mundo que Deus confia a cada um de nós.',
        source: 'Amigos de Deus, n. 39',
      },
      {
        quote:
          'Quando tiveres ordem, multiplicar-se-á o teu tempo e, portanto, poderás dar mais glória a Deus, trabalhando mais a seu serviço.',
        source: 'Caminho, n. 80',
      },
    ],
    intentionA:
      'Para que, com o auxílio de Maria Santíssima, consiga um trabalho estável e apropriado. E que, quando — por bondade de Deus — já estiver trabalhando, saiba aproveitar o tempo como um tesouro que é; e me esmere em aprimorar a virtude da ordem, de modo que consiga fazer tudo com pontualidade, intensidade e constância, sem confusões nem atrasos, seguindo um plano bem estruturado, que me permita dedicar, de modo equilibrado, os horários convenientes a cada um dos meus deveres: vida espiritual, família, profissão e relações sociais.',
    intentionB:
      'Para que, com o auxílio de Maria Santíssima, saiba aproveitar o tempo como um tesouro que é; e que me esmere em aprimorar a virtude da ordem, de modo que consiga fazer tudo com pontualidade, intensidade e constância, sem confusões nem atrasos, seguindo um plano bem estruturado, que me permita dedicar, de modo equilibrado, os horários convenientes a cada um dos meus deveres: vida espiritual, família, profissão e relações sociais.',
  },
  {
    ordinal: 'Quarto',
    month: 6,
    day: 20,
    dateLabel: '20 de junho',
    theme: 'Trabalho bem acabado',
    reflections: [
      {
        quote:
          'Não podemos oferecer ao Senhor uma coisa que, dentro das pobres limitações humanas, não seja perfeita, sem mancha, realizada com atenção até nos mínimos detalhes: Deus não aceita trabalhos «marretados». Por isso o trabalho de cada qual – essa atividade que ocupa as nossas jornadas e energias – há de ser uma oferenda digna aos olhos do Criador; numa palavra, uma tarefa acabada, impecável.',
        source: 'Amigos de Deus, n. 55',
      },
      {
        quote:
          'Antes de mais, devemos amar a Santa Missa, que tem que ser o centro do nosso dia. Se a vivermos bem, como não havemos de continuar depois com o pensamento no Senhor, para trabalhar como Ele trabalhava e amar como Ele amava?',
        source: 'Cfr. É Cristo que passa, n. 15',
      },
    ],
    intentionA:
      'Para que, com o auxílio de Nossa Senhora, não demore a resolver-se o problema do meu desemprego. E para que, ao iniciar o novo trabalho, Deus me ajude a colocar todo o empenho em realizá-lo com categoria, com a maior perfeição possível, sem fazer as tarefas de qualquer maneira — convencido de que um trabalho mal feito não pode ser santificado, porque lhe falta amor, que é a condição imprescindível para que qualquer atividade humana possa ser agradável a Deus.',
    intentionB:
      'Para que Deus me ajude a colocar todo o empenho em realizar o meu trabalho com categoria, com a maior perfeição possível, sem fazer as tarefas de qualquer maneira — convencido de que um trabalho mal feito não pode ser santificado, porque lhe falta amor, que é a condição imprescindível para que qualquer atividade humana possa ser agradável a Deus.',
  },
  {
    ordinal: 'Quinto',
    month: 6,
    day: 21,
    dateLabel: '21 de junho',
    theme: 'Todos os trabalhos honestos são dignos',
    reflections: [
      {
        quote:
          'É hora de que todos nós, cristãos, anunciemos bem alto que o trabalho é um dom de Deus, e que não faz nenhum sentido dividir os homens em diferentes categorias, conforme os tipos de trabalho, considerando umas ocupações mais nobres do que as outras. O trabalho, todo trabalho, é testemunho da dignidade do homem.',
        source: 'É Cristo que passa, n. 47',
      },
      {
        quote:
          'Diante de Deus, nenhuma ocupação é em si grande ou pequena. Tudo adquire o valor do Amor com que se realiza.',
        source: 'Sulco, n. 487',
      },
    ],
    intentionA:
      'Para que Deus me conceda a alegria de conseguir trabalho, uma tarefa em que eu possa ser útil e desenvolver as minhas capacidades. E que se, no momento, esse trabalho estiver por baixo do meu preparo e das minhas legítimas aspirações, eu não o despreze, mas – enquanto não achar um trabalho mais apropriado – o realize com toda a responsabilidade, fazendo com que tenha a categoria do trabalho que Jesus realizou na oficina de Nazaré.',
    intentionB:
      'Para que se, atualmente, o meu trabalho está por baixo do meu preparo e das minhas legítimas aspirações, Deus me ajude a não o desprezar, mas – enquanto não achar um trabalho mais apropriado – a realizá-lo com toda a responsabilidade, fazendo com que tenha a categoria do trabalho que Jesus realizou na oficina de Nazaré.',
  },
  {
    ordinal: 'Sexto',
    month: 6,
    day: 22,
    dateLabel: '22 de junho',
    theme: 'Trabalhar em companhia de Deus e com reta intenção',
    reflections: [
      {
        quote:
          'Deves manter – ao longo do dia – uma constante conversa com o Senhor, que se alimente também das próprias incidências da tua tarefa profissional.',
        source: 'Forja, n. 745',
      },
      {
        quote:
          'Como cristão, deverias trazer sempre contigo o teu Crucifixo. E colocá-lo sobre a tua mesa de trabalho. E beijá-lo antes de te entregares ao descanso e ao acordar.',
        source: 'Caminho, n. 302',
      },
      {
        quote:
          'Coloca na tua mesa de trabalho, no teu quarto, na tua carteira…, uma imagem de Nossa Senhora, e dirige-lhe o olhar ao começares a tua tarefa, enquanto a realizas e ao terminá-la. Ela te alcançará – garanto! – a força necessária para fazeres, da tua ocupação, um diálogo amoroso com Deus.',
        source: 'Sulco, n. 531',
      },
    ],
    intentionA:
      'Para que Deus me conceda um emprego honesto e digno, e me abra os olhos da alma para compreender que Ele está sempre ao meu lado. Que, para não perder de vista esta maravilhosa realidade, eu me esforce em ter presença de Deus durante o trabalho, servindo-me discretamente — como de um «lembrete» — de um pequeno crucifixo, de uma estampa de Nossa Senhora, da efígie de outro santo da minha devoção…; «lembretes» colocados onde eu os possa ver com frequência, sem exibicionismo nem alarde.',
    intentionB:
      'Para que Deus me faça compreender que Ele está sempre ao meu lado, enquanto estou trabalhando. E que, para não perder de vista esta maravilhosa realidade, eu me esforce em ter presença de Deus durante o trabalho, servindo-me discretamente — como de um «lembrete» — de um pequeno crucifixo, de uma estampa de Nossa Senhora, da efígie de outro santo da minha devoção…; «lembretes» colocados onde eu os possa ver com frequência, sem exibicionismo nem alarde.',
  },
  {
    ordinal: 'Sétimo',
    month: 6,
    day: 23,
    dateLabel: '23 de junho',
    theme: 'Amadurecer nas virtudes através do trabalho',
    reflections: [
      {
        quote:
          'Tudo aquilo em que intervimos os pobrezinhos dos homens – mesmo a santidade – é um tecido de pequenas insignificâncias que, conforme a intenção com que se fazem, podem formar uma tapeçaria esplêndida de heroísmo ou de baixeza, de virtudes ou de pecados.',
        source: 'Caminho, n. 826',
      },
      {
        quote:
          'É toda uma trama de virtudes que se põe em jogo quando exercemos o nosso ofício com o propósito de santificá-lo: a fortaleza, para perseverarmos no trabalho, apesar das naturais dificuldades; a temperança, para superarmos o comodismo e o egoísmo; a justiça, para cumprirmos os nossos deveres para com Deus, para com a sociedade, para com a família, para com os colegas; a prudência, para sabermos em cada caso o que convém fazer e nos lançarmos à obra sem dilações… E tudo por Amor…',
        source: 'Amigos de Deus, n. 72',
      },
    ],
    intentionA:
      'Para que, com a ajuda de Nossa Senhora, ache o trabalho que venho procurando. E que, ao meter-me em cheio nesse novo trabalho, Deus me ajude a desenvolver por meio dele as virtudes cristãs e a amadurecer espiritualmente. Que eu procure ser paciente e compreensivo, tanto com os chefes como com os colegas e subordinados, que seja simples e humilde, fugindo da vaidade e do exibicionismo, que faça tudo, em suma, com pureza de coração.',
    intentionB:
      'Para que Deus me ajude a desenvolver por meio do trabalho as virtudes cristãs e a amadurecer espiritualmente. Que eu procure ser paciente e compreensivo, tanto com os chefes como com os colegas e subordinados, que seja simples e humilde, fugindo da vaidade e do exibicionismo, que faça tudo, em suma, com pureza de coração.',
  },
  {
    ordinal: 'Oitavo',
    month: 6,
    day: 24,
    dateLabel: '24 de junho',
    theme: 'Trabalhar é servir, ajudar os outros',
    reflections: [
      {
        quote:
          'Pensai que através dos vossos afazeres profissionais, realizados com responsabilidade, além de vos sustentardes economicamente, prestais um serviço diretíssimo ao desenvolvimento da sociedade, aliviais também as cargas dos outros e mantendes muitas obras assistenciais – em nível local e universal – em prol dos indivíduos e dos povos menos favorecidos.',
        source: 'Amigos de Deus, n. 120',
      },
    ],
    intentionA:
      'Para que Deus Nosso Senhor me conceda o trabalho que lhe peço com tanta fé. E para que infunda na minha alma o desejo de fazer do meu trabalho, não uma atividade egoísta, fechada nos meus interesses, mas um serviço aberto ao bem e à utilidade de muitos, realizado com a certeza de que esse ideal de serviço aos outros dará um novo sentido, mais elevado e alegre, à minha vida.',
    intentionB:
      'Para que Deus infunda na minha alma o desejo de fazer do meu trabalho, não uma atividade egoísta, fechada nos meus interesses, mas um serviço aberto ao bem e à utilidade de muitos, realizado com a certeza de que esse ideal de serviço aos outros dará um novo sentido, mais elevado e alegre, à minha vida.',
  },
  {
    ordinal: 'Nono',
    month: 6,
    day: 25,
    dateLabel: '25 de junho',
    theme: 'Fazer apostolado com o nosso trabalho',
    reflections: [
      {
        quote:
          'O trabalho profissional é também apostolado, ocasião de entrega aos outros homens; o momento de lhes revelar Cristo e levá-los a Deus Pai.',
        source: 'É Cristo que passa, n. 49',
      },
      {
        quote:
          'Faze a tua vida normal; trabalha onde estás, procurando cumprir os deveres do teu estado, acabar bem as tarefas da tua profissão ou do teu ofício, superando-te, melhorando dia a dia. Sê leal, compreensivo com os outros e exigente contigo mesmo. Sê mortificado e alegre. Esse será o teu apostolado. E, sem saberes por quê, dada a tua pobre miséria, os que te rodeiam virão ter contigo e, numa conversa natural, simples – à saída do trabalho, numa reunião familiar, no ônibus, ao dar um passeio em qualquer parte –, falareis de inquietações que existem na alma de todos, embora às vezes alguns não as queiram reconhecer: irão entendendo-as melhor quando começarem a procurar Deus a sério.',
        source: 'Amigos de Deus, n. 273',
      },
    ],
    intentionA:
      'Para que Deus, por mediação de Nossa Senhora, me faça encontrar um bom trabalho, no qual possa crescer profissionalmente e dar o melhor de mim mesmo. E que me ajude a ver, no meu ambiente profissional, um campo aberto para a realização da missão apostólica que Deus confia a todos os batizados, aproveitando as oportunidades que Ele me dá para ajudar colegas, amigos, colaboradores, clientes…, a descobrirem as maravilhas da fé cristã.',
    intentionB:
      'Para que Deus me ajude a ver, no meu ambiente de trabalho, um campo aberto para a realização da missão apostólica que Deus confia a todos os batizados, aproveitando as oportunidades que Ele me dá para ajudar colegas, amigos, colaboradores, clientes…, a descobrirem as maravilhas da fé cristã.',
  },
]

/** Length of the novena — nine days (its span when started manually). */
export const NOVENA_LENGTH = DAYS.length

/**
 * Index (0–8) of the novena day matching the given date, or null if the date
 * falls outside the 17–25 June window. Matches on month/day so it recurs yearly.
 */
export function getNovenaDayIndex(date: Date): number | null {
  const m = date.getMonth() + 1
  const d = date.getDate()
  const i = DAYS.findIndex((day) => day.month === m && day.day === d)
  return i === -1 ? null : i
}

/**
 * Index (0–8) into the novena when it was MANUALLY started on `startISO`
 * (a YYYY-MM-DD date) and `viewDate` falls within the nine-day span beginning
 * that day; null when there is no manual start, or the date is before it or past
 * the ninth day. This is what makes a manual run "expire" on its own: once the
 * ninth day passes it stops matching and the novena leaves the daily list.
 */
export function manualNovenaDayIndex(
  startISO: string | null | undefined,
  viewDate: Date
): number | null {
  if (!startISO) return null
  const diff = differenceInCalendarDays(viewDate, parseISO(startISO))
  return diff >= 0 && diff < DAYS.length ? diff : null
}

/**
 * Which novena day (0–8) to show for a view date: a manual run takes precedence
 * within its nine-day span, otherwise the fixed 17–25 June calendar. Null when
 * neither applies. (`0` is a valid index, so this coalesces on null only.)
 */
function novenaDayIndex(viewDate: Date, startISO: string | null | undefined): number | null {
  return manualNovenaDayIndex(startISO, viewDate) ?? getNovenaDayIndex(viewDate)
}

/** True when a manual run of the novena covers `viewDate` (drives visibility). */
export function isNovenaManuallyActiveOn(
  practice: Pick<Practice, 'bundledTextId'>,
  viewDate: Date,
  startISO: string | null | undefined
): boolean {
  return (
    practice.bundledTextId === NOVENA_TRABALHO_BUNDLED_ID &&
    manualNovenaDayIndex(startISO, viewDate) !== null
  )
}

/**
 * Is the practice shown on `viewDate`? Its ordinary calendar window (season.ts)
 * OR — for the novena only — an in-progress manual run started outside it. Use
 * this everywhere the daily list / history / report decides visibility, so a
 * manually-started novena behaves exactly like the seasonal one, on new dates.
 */
export function isPracticeVisibleOn(
  practice: Pick<Practice, 'activeWindow' | 'bundledTextId'>,
  viewDate: Date,
  novenaStartISO: string | null | undefined
): boolean {
  return (
    isInActiveWindow(practice, viewDate) ||
    isNovenaManuallyActiveOn(practice, viewDate, novenaStartISO)
  )
}

function dayMarkdown(d: NovenaDay): string {
  const reflections = d.reflections
    .map((r) => `*${r.quote}*\n— ${r.source}`)
    .join('\n\n')
  return [
    `## ${d.ordinal} dia — ${d.dateLabel}`,
    `### ${d.theme}`,
    '*Palavras de São Josemaria Escrivá*',
    reflections,
    '**Intenções**',
    '*A — para encontrar trabalho · B — para fazer um bom trabalho*',
    `**A.** ${d.intentionA}`,
    `**B.** ${d.intentionB}`,
    '---',
    '**Oração a São Josemaria**',
    OPENING_PRAYER,
    '*Pai-nosso, Ave-Maria, Glória.*',
  ].join('\n\n')
}

/**
 * The bundled text to render in the reader for the novena practice on a given
 * viewing date — returns null for any non-novena practice (the caller then
 * falls back to the ordinary bundled-text lookup). Outside the window it
 * defaults to the first day so the reader is never blank (it is not normally
 * reachable then, since the practice is hidden out of window).
 */
export function resolveNovenaReaderText(
  practice: Pick<Practice, 'bundledTextId'>,
  date: Date,
  startISO?: string | null
): BundledText | null {
  if (practice.bundledTextId !== NOVENA_TRABALHO_BUNDLED_ID) return null
  const day = DAYS[novenaDayIndex(date, startISO) ?? 0]
  return {
    id: NOVENA_TRABALHO_BUNDLED_ID,
    title: { pt: NOVENA_TRABALHO_NAME },
    hasImage: false,
    texts: { pt: dayMarkdown(day) },
  }
}

/**
 * Short "Nº dia · theme" label for the daily-list row, or null if the practice
 * isn't the novena or the date is outside its window.
 */
export function novenaRowSubtitle(
  practice: Pick<Practice, 'bundledTextId'>,
  date: Date,
  startISO?: string | null
): string | null {
  if (practice.bundledTextId !== NOVENA_TRABALHO_BUNDLED_ID) return null
  const i = novenaDayIndex(date, startISO)
  if (i === null) return null
  const d = DAYS[i]
  return `${d.ordinal} dia · ${d.theme}`
}
