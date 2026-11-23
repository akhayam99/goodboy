export type CheckPayload = Readonly<{
  name: string;
  detailsUrl: string | null;
  logTail: string | null;
  branch: string | null;
  prNumber: number | null;
  prUrl: string | null;
  changedPaths: ReadonlyArray<string>;
  note: string;
}>;

type Params = {
  readonly payload: CheckPayload;
};

const MAX_PATHS = 20;

const evidenceOf = ({ payload }: Params): ReadonlyArray<string> => {
  if (payload.logTail !== null && payload.logTail.trim() !== '') {
    return ['The end of the failed log:', '```', payload.logTail.trimEnd(), '```'];
  }
  const paths = payload.changedPaths.slice(0, MAX_PATHS);
  return [
    payload.detailsUrl === null
      ? 'There is no log to read here.'
      : `Its page: ${payload.detailsUrl}`,
    ...(paths.length === 0 ? [] : ['Files the PR changes:', ...paths.map((path) => `- ${path}`)]),
  ];
};

export const checkPayloadOf = ({ payload }: Params): string => {
  const where = [
    payload.branch === null ? null : `branch ${payload.branch}`,
    payload.prNumber === null ? null : `PR #${payload.prNumber}`,
    payload.prUrl,
  ].filter((part): part is string => part !== null && part !== '');
  return [
    `The check ${payload.name} failed. Find why and fix it on this branch.`,
    where.length === 0 ? null : `Where: ${where.join(', ')}.`,
    evidenceOf({ payload }).join('\n'),
    payload.note.trim() === '' ? null : `A note from me: ${payload.note.trim()}`,
  ]
    .filter((part): part is string => part !== null)
    .join('\n\n');
};
