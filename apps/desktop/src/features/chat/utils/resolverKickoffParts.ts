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

type OffsetsParams = {
  readonly human: string;
};

const markerOffsetsOf = ({ human }: OffsetsParams): ReadonlyArray<number> => {
  const offsets: Array<number> = [];
  let from = human.indexOf(NOTES_MARKER);
  while (from !== -1) {
    offsets.push(from);
    from = human.indexOf(NOTES_MARKER, from + 1);
  }
  return offsets.reverse();
};

export const rulesOfKickoff = ({ message, human }: SplitParams): string | null => {
  for (const at of [...markerOffsetsOf({ human }), -1]) {
    const head = at === -1 ? human : human.slice(0, at);
    const tail = at === -1 ? '' : human.slice(at);
    const start = head.length + 2;
    const end = message.length - tail.length;
    if (message.startsWith(`${head}\n\n`) && message.endsWith(tail) && end > start) {
      return message.slice(start, end);
    }
  }
  return null;
};
