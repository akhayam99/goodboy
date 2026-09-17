import { redactSecrets } from '../../shared/utils/redactSecrets';

export const DIFF_SCOUT_LIMITS = {
  goal: 600,
  brief: 900,
  paths: 30,
} as const;

export type DiffScout = Readonly<{
  name: string;
  scope: string;
}>;

const clip = ({ text, limit }: Readonly<{ text: string; limit: number }>): string => {
  const collapsed = text.trim();
  return collapsed.length <= limit ? collapsed : `${collapsed.slice(0, limit)}...`;
};

const pathsLine = ({ paths }: Readonly<{ paths: ReadonlyArray<string> }>): string => {
  if (paths.length === 0) {
    return '**Changed paths** the diff named no path, so report that and stop.';
  }
  const kept = paths.slice(0, DIFF_SCOUT_LIMITS.paths);
  const rest = paths.length - kept.length;
  const tail = rest === 0 ? '' : ` ${rest} more paths changed and are not listed here.`;
  return `**Changed paths** the diff touches these ${paths.length} paths and only these are your ground: ${kept.join(', ')}.${tail} never walk the repository looking for more.`;
};

type Params = Readonly<{
  scout: DiffScout;
  others: ReadonlyArray<DiffScout>;
  root: string;
  goal: string;
  brief: string | null;
  paths: ReadonlyArray<string>;
}>;

export const composeDiffScoutKickoff = ({
  scout,
  others,
  root,
  goal,
  brief,
  paths,
}: Params): string => {
  const trimmedBrief = brief === null ? '' : brief.trim();
  const otherScopes = others
    .map((entry) => `${entry.name} is reading ${entry.scope}`)
    .join(' ')
    .trim();
  return [
    `**Root** ${root}. read under this path. a trail that leaves it is worth one line saying where it went, never a second sweep.`,
    `**Scope** ${scout.scope}`,
    otherScopes.length === 0
      ? '**Not yours** nothing, you are the only scout on this report.'
      : `**Not yours** ${otherScopes} do not read that ground, it is already covered.`,
    `**Goal** ${redactSecrets({ text: clip({ text: goal, limit: DIFF_SCOUT_LIMITS.goal }) })}`,
    ...(trimmedBrief.length === 0
      ? []
      : [
          `**Brief** ${redactSecrets({ text: clip({ text: trimmedBrief, limit: DIFF_SCOUT_LIMITS.brief }) })}`,
        ]),
    pathsLine({ paths }),
    '**Claims** every claim is one line that ends with a repo-relative path. a claim with no path is dropped without discussion, so cite the file you read it in. a path the diff deleted is still worth citing: name it and say it is gone.',
    '**Bound** one turn. never split into sub agents, never ask for more turns. a report agent is waiting on this report and will write the document from it.',
  ].join('\n');
};
