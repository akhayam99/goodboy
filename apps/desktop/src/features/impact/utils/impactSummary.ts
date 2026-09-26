import type { ImpactWindowId } from '../lib';

export type SummaryPart = {
  readonly text: string;
  readonly isStrong: boolean;
};

type Params = {
  readonly windowId: ImpactWindowId;
  readonly workspaceName: string | null;
  readonly sessionCount: number;
  readonly mergedPullRequests: number | null;
  readonly spendText: string | null;
  readonly workflowShare: number | null;
};

type CountParams = {
  readonly count: number;
  readonly singular: string;
  readonly plural: string;
};

const LEAD = {
  last7: 'In the last 7 days',
  last30: 'In the last 30 days',
  all: 'So far',
} satisfies Record<ImpactWindowId, string>;

const counted = ({ count, singular, plural }: CountParams): string =>
  `${count} ${count === 1 ? singular : plural}`;

const plain = (text: string): SummaryPart => ({ text, isStrong: false });
const strong = (text: string): SummaryPart => ({ text, isStrong: true });

export const impactSummary = ({
  windowId,
  workspaceName,
  sessionCount,
  mergedPullRequests,
  spendText,
  workflowShare,
}: Params): ReadonlyArray<SummaryPart> | null => {
  if (sessionCount === 0) {
    return null;
  }
  const clauses: Array<ReadonlyArray<SummaryPart>> = [
    [
      plain('ran '),
      strong(counted({ count: sessionCount, singular: 'session', plural: 'sessions' })),
      ...(workspaceName === null ? [] : [plain(` in ${workspaceName}`)]),
    ],
  ];
  if (mergedPullRequests !== null) {
    clauses.push([
      plain('merged '),
      strong(
        counted({ count: mergedPullRequests, singular: 'pull request', plural: 'pull requests' }),
      ),
    ]);
  }
  if (spendText !== null) {
    clauses.push([plain('spent '), strong(spendText)]);
  }
  const joined = clauses.flatMap((clause, index) => {
    if (index === 0) {
      return clause;
    }
    const separator = index === clauses.length - 1 ? ' and ' : ', ';
    return [plain(separator), ...clause];
  });
  const workflowSentence =
    workflowShare === null
      ? []
      : [
          plain('. Workflows ran '),
          strong(`${Math.round(workflowShare * 100)}%`),
          plain(' of sessions'),
        ];
  return [plain(`${LEAD[windowId]} Goodboy `), ...joined, ...workflowSentence, plain('.')];
};
