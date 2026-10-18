import { formatBytes } from '../../../../../../shared/utils/formatBytes';
import type { ChangeTurn } from '../../../../../file-versions/changeTurnsOf';

type Params = Readonly<{ turns: ReadonlyArray<ChangeTurn> }>;

export type SkippedLine = Readonly<{ relativePath: string; reason: string }>;

const REASON_WORDS: ReadonlyMap<string, string> = new Map([
  ['too_large', 'over 15 MB'],
  ['link', 'a link'],
  ['link_outside', 'a link that leaves the folder'],
  ['skipped_folder', 'dependencies or build output'],
  ['session_folder', 'an older session folder'],
  ['not_regular_file', 'not a regular file'],
  ['unreadable', "it couldn't be read"],
  ['folder_limit', 'past the size limit for saved versions'],
]);

export const skippedLinesOf = ({ turns }: Params): ReadonlyArray<SkippedLine> => {
  const seen = new Map<string, SkippedLine>();
  for (const turn of turns) {
    for (const skip of turn.skipped) {
      if (seen.has(skip.relativePath)) {
        continue;
      }
      const words = REASON_WORDS.get(skip.reason) ?? 'left out';
      const reason =
        skip.reason === 'too_large' && skip.sizeBytes !== null
          ? `${formatBytes({ bytes: skip.sizeBytes })}, ${words}`
          : words;
      seen.set(skip.relativePath, { relativePath: skip.relativePath, reason });
    }
  }
  return Array.from(seen.values());
};
