import type { TurnEvent } from '@goodboy/types';

type Params = Readonly<{
  transcripts: ReadonlyArray<ReadonlyArray<TurnEvent>>;
}>;

const MAX_TITLE_CHARS = 80;

export const turnTitlesOf = ({ transcripts }: Params): Readonly<Record<string, string>> => {
  const titles: Record<string, string> = {};
  for (const events of transcripts) {
    for (const event of events) {
      if (event.kind !== 'user_text' || titles[event.runId] !== undefined) {
        continue;
      }
      const line = event.text
        .split('\n')
        .map((part) => part.trim())
        .find((part) => part !== '');
      if (line === undefined) {
        continue;
      }
      titles[event.runId] =
        line.length > MAX_TITLE_CHARS ? `${line.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…` : line;
    }
  }
  return titles;
};
