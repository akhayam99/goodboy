import type { ChangeTurn } from './changeTurnsOf';

type Params = Readonly<{
  runId: string;
  changedSince: ReadonlyArray<string>;
  turns: ReadonlyArray<ChangeTurn>;
  writers: Readonly<Record<string, string>>;
}>;

export const otherWritersOf = ({
  runId,
  changedSince,
  turns,
  writers,
}: Params): ReadonlyArray<string> => {
  const target = turns.find((turn) => turn.runId === runId);
  if (target === undefined) {
    return [];
  }
  const own = writers[runId];
  const names = new Set<string>();
  for (const turn of turns) {
    const name = writers[turn.runId];
    if (turn.finishedAtMs <= target.finishedAtMs || name === undefined || name === own) {
      continue;
    }
    if (turn.files.some((file) => changedSince.includes(file.relativePath))) {
      names.add(name);
    }
  }
  return Array.from(names);
};
