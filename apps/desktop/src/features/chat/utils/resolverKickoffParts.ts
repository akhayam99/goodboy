import { RESOLVER_KICKOFF_LABELS } from './resolverKickoffLabels';

export type KickoffParts = Readonly<{
  head: string;
  rules: string;
  tail: string;
}>;

type NoteParams = {
  readonly hint: string;
};

export const kickoffTail = ({ hint }: NoteParams): string => {
  const note = hint.trim();
  return note.length === 0 ? '' : `\n\n${RESOLVER_KICKOFF_LABELS.operatorNotes}\n${note}`;
};

export const joinKickoffParts = ({ head, rules, tail }: KickoffParts): string =>
  `${head}\n\n${rules}${tail}`;

export const humanOfKickoff = ({ head, tail }: KickoffParts): string => `${head}${tail}`;

type SplitParams = {
  readonly message: string;
  readonly human: string;
};

const NOTES_MARKER = `\n\n${RESOLVER_KICKOFF_LABELS.operatorNotes}\n`;

export const rulesOfKickoff = ({ message, human }: SplitParams): string | null => {
  const at = human.lastIndexOf(NOTES_MARKER);
  const head = at === -1 ? human : human.slice(0, at);
  const tail = at === -1 ? '' : human.slice(at);
  const start = head.length + 2;
  const end = message.length - tail.length;
  const isConsistent = message.startsWith(`${head}\n\n`) && message.endsWith(tail) && end > start;
  return isConsistent ? message.slice(start, end) : null;
};
