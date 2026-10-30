import type { SessionLanguage } from './sessionLanguages';

type WordsParams = { readonly words: string };

const setOf = ({ words }: WordsParams): ReadonlySet<string> => new Set(words.split(' '));

export const LANGUAGE_STOPWORDS = {
  it: setOf({
    words:
      'il lo la le gli un uno una di del dello della dei degli delle che non per con su sul sulla sui sulle nel nella nei nelle al alla ai alle dal dalla dai dalle come più sono siamo sia anche ma questo questa questi queste quello quella quelli ho hai abbiamo hanno devo deve devi dovrebbe puoi può possiamo fare fai cosa perché perche quando dove tutti tutto tutte ogni dell nell sull dall quindi poi solo ancora senza tra fra mi ti ci vi si ne è già gia dopo prima ora adesso invece però pero oppure mentre sempre mai molto molti troppo vorrei voglio e',
  }),
  en: setOf({
    words:
      'the an and or but is are was were be been being have has had does did will would should could can may might must to of at by for with from that this these those it its they them their we our you your he she his her what which who when where why how if then than also just only more most some any each every about into over after before there here please need make use not',
  }),
  es: setOf({
    words:
      'el la los las un unos unas de del al en con sin por para que es está están son fue ser tiene tienen tengo tenemos usted como más muy también pero si esto eso este esta ese esa estos esos aquí ya entonces cuando donde dónde porque sobre entre hasta mi tu su nuestro hacer necesita necesito puede puedo antes después todavía solo lo se le cómo qué cuál según hay nos otro otra todo todos todas mejor siempre nunca quiero debe debes deberías',
  }),
  pt: setOf({
    words:
      'os um uma uns umas de do dos das em nos nas para por com sem não nao que e é está estão são foi ser ter tem têm tenho temos você voce como mais muito também tambem mas ou se isso isto esse essa esta este estes essas aqui já ja então entao quando onde porque pelo pela pelos pelas ao aos às nosso minha meu seu sua fazer precisa preciso pode posso antes depois ainda só apenas sobre entre até ate ele ela eles elas quero deve deveria',
  }),
  fr: setOf({
    words:
      'le la les un une des du de à dans en sur sous avec sans pour par que qui et est sont était être avoir ont ce cette ces cet mon ma mes ton son sa ses notre nous vous ils elles je tu il elle pas ne plus très aussi mais où donc car quand comment pourquoi faire peut peux dois doit avant après encore seulement tout tous toute toutes au aux voulez veux',
  }),
  de: setOf({
    words:
      'der die das den dem des ein eine einen einem einer eines und oder aber nicht ist sind waren wird werden wurde hat haben habe kann können muss müssen soll sollte mit von zu zum zur für auf aus bei nach über unter vor durch gegen ohne um wie wenn dass auch noch nur sehr schon dann diese dieser dieses ich du er sie wir ihr mein dein sein unser bitte im am vom beim ins',
  }),
} as const satisfies Record<SessionLanguage, ReadonlySet<string>>;
