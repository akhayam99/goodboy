export const REPORT_TYPES = ['session-summary', 'change-summary'] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  'session-summary': 'Session summary',
  'change-summary': 'Local change report',
};

export const REPORT_TYPE_HINT: Record<ReportType, string> = {
  'session-summary': 'what the session set out to do, what landed, what is still open',
  'change-summary':
    'the local change as a reviewer reads it: branch commits, diff, checks that ran, risk',
};

const REPORT_TYPE_ALIAS: Readonly<Record<string, ReportType>> = {
  'pr-report': 'change-summary',
};

export const asReportType = ({ value }: { readonly value: string }): ReportType | null =>
  REPORT_TYPES.find((candidate) => candidate === value) ?? REPORT_TYPE_ALIAS[value] ?? null;
