export const REPORT_TYPES = ['session-summary', 'pr-report'] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  'session-summary': 'Session summary',
  'pr-report': 'PR report',
};

export const REPORT_TYPE_HINT: Record<ReportType, string> = {
  'session-summary': 'what the session set out to do, what landed, what is still open',
  'pr-report': 'the change as a reviewer reads it: scope, diff, verification, risk',
};

export const asReportType = ({ value }: { readonly value: string }): ReportType | null =>
  (REPORT_TYPES as ReadonlyArray<string>).includes(value) ? (value as ReportType) : null;
