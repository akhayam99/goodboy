import { RUN_ROUTE_COPY } from './runRouteCopy';

type Params = {
  readonly done: ReadonlyArray<string>;
  readonly summaries: ReadonlyArray<Readonly<{ name: string; summary: string | null | undefined }>>;
};

const FINDING_LENGTH = 280;

const MAX_FINDINGS = 8;

type ClipParams = {
  readonly text: string;
};

const clipped = ({ text }: ClipParams): string => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > FINDING_LENGTH ? `${line.slice(0, FINDING_LENGTH - 3)}...` : line;
};

export const runFindingsOf = ({ done, summaries }: Params): string => {
  const lines = [
    ...done.map((entry) => clipped({ text: entry })),
    ...summaries
      .filter((entry) => (entry.summary ?? '').trim() !== '')
      .map((entry) => `${entry.name}: ${clipped({ text: entry.summary ?? '' })}`),
  ]
    .filter((line) => line !== '')
    .slice(0, MAX_FINDINGS);
  if (lines.length === 0) {
    return '';
  }
  return [RUN_ROUTE_COPY.findings, ...lines.map((line) => `- ${line}`)].join('\n');
};
