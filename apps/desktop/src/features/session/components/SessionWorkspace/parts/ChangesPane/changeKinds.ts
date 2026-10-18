import type { Tone } from '@goodboy/ui';
import type { ChangeFile } from '../../../../../file-versions/changeTurnsOf';

type ChangeKindCopy = Readonly<{
  letter: string;
  word: string;
  tone: Tone;
  verb: string;
}>;

export const CHANGE_KINDS = {
  added: { letter: 'N', word: 'New file', tone: 'success', verb: 'New in' },
  modified: { letter: 'M', word: 'Changed', tone: 'warning', verb: 'Changed in' },
  deleted: { letter: 'D', word: 'Removed', tone: 'danger', verb: 'Removed in' },
} as const satisfies Record<ChangeFile['change'], ChangeKindCopy>;
