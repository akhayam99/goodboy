import type { Fact } from '@goodboy/ui';
import type { BaseDivergence, Project } from '@goodboy/types';

type Entry = {
  readonly project: Pick<Project, 'name'>;
  readonly report: BaseDivergence | undefined;
};

type Params = {
  readonly entries: ReadonlyArray<Entry>;
};

export type RepoEntryFacts = {
  readonly label: string | null;
  readonly dot: 'info' | 'warning' | null;
  readonly isFailed: boolean;
  readonly summary: string;
  readonly rows: ReadonlyArray<Fact>;
};

type CountParams = {
  readonly count: number;
};

const reposWord = ({ count }: CountParams): string => (count === 1 ? '1 repo' : `${count} repos`);

type RowParams = {
  readonly project: Pick<Project, 'name'>;
  readonly report: BaseDivergence;
};

const rowOf = ({ project, report }: RowParams): Fact | null => {
  const base = report.base ?? 'base';
  switch (report.state) {
    case 'behind':
      return { label: project.name, value: `${report.behind} behind`, note: base, tone: 'info' };
    case 'diverged':
      return {
        label: project.name,
        value: 'Diverged',
        note: report.upstream ?? 'origin',
        tone: 'warning',
      };
    case 'fetch-failed':
      return { label: project.name, value: "Can't reach origin", tone: 'danger' };
    case 'up-to-date':
    case 'ahead':
    case 'no-upstream':
    case 'no-base':
    case 'missing':
      return null;
    default: {
      const exhaustive: never = report.state;
      return exhaustive;
    }
  }
};

export const repoEntryFactsOf = ({ entries }: Params): RepoEntryFacts => {
  const reports = entries.flatMap(({ project, report }) =>
    report === undefined ? [] : [{ project, report }],
  );
  const behind = reports.filter(({ report }) => report.state === 'behind');
  const diverged = reports.filter(({ report }) => report.state === 'diverged');
  const failedCount = reports.filter(({ report }) => report.state === 'fetch-failed').length;
  const parts: Array<string> = [];
  if (behind.length === 1) {
    parts.push(`${behind[0]?.report.behind ?? 0} behind`);
  }
  if (behind.length > 1) {
    parts.push(`${behind.length} repos behind`);
  }
  if (diverged.length > 0) {
    parts.push(diverged.length === 1 ? 'Diverged' : `${diverged.length} diverged`);
  }
  const isFailed = parts.length === 0 && failedCount > 0;
  const rows = reports.flatMap((entry) => rowOf(entry) ?? []);
  const isChecked = reports.length > 0;
  const summary = isChecked
    ? `${reposWord({ count: entries.length })}, nothing to pull from origin`
    : `${reposWord({ count: entries.length })}, checking origin`;
  return {
    label: isFailed ? 'Check failed' : parts.length === 0 ? null : parts.join(' · '),
    dot: diverged.length > 0 ? 'warning' : behind.length > 0 ? 'info' : null,
    isFailed,
    summary,
    rows,
  };
};
