import type { LeadFinding } from './LeadFinding';

type Params = {
  readonly finding: LeadFinding;
  readonly projectName: string;
  readonly note: string;
};

export const findingPayloadOf = ({ finding, projectName, note }: Params): string =>
  [
    `A finding from ${finding.source} on ${projectName} for you to look into (${finding.id}):`,
    finding.text
      .trimEnd()
      .split('\n')
      .map((line) => (line === '' ? '>' : `> ${line}`))
      .join('\n'),
    finding.link === null ? null : `Its page: ${finding.link}`,
    note.trim() === '' ? null : `A note from me: ${note.trim()}`,
  ]
    .filter((part): part is string => part !== null)
    .join('\n\n');
