import { REPORT_ISSUE_REPO } from './components/ReportIssueStudio/issuePayload';

const NEW_ISSUE_URL = `https://github.com/${REPORT_ISSUE_REPO}/issues/new`;

export const CRASH_TRACE_BUDGET = 1500;

const HOME_PATH_PATTERNS: ReadonlyArray<RegExp> = [
  /\/Users\/[^/\s"')]+/g,
  /\/home\/[^/\s"')]+/g,
  /[A-Za-z]:\\Users\\[^\\\s"')]+/g,
];

type CollapseHomePathsParams = {
  readonly text: string;
};

export const collapseHomePaths = ({ text }: CollapseHomePathsParams): string =>
  HOME_PATH_PATTERNS.reduce((carried, pattern) => carried.replace(pattern, '~'), text);

type CapTraceParams = {
  readonly trace: string;
};

const capTrace = ({ trace }: CapTraceParams): string => {
  if (trace.length <= CRASH_TRACE_BUDGET) {
    return trace;
  }

  const kept = trace.slice(0, CRASH_TRACE_BUDGET);
  return `${kept}\n[cut here: ${trace.length - CRASH_TRACE_BUDGET} more characters were not included]`;
};

export type CrashReport = {
  readonly url: string;
  readonly title: string;
  readonly body: string;
};

type BuildCrashReportParams = {
  readonly error: Error;
  readonly componentStack: string | null;
  readonly version: string | null;
};

export const buildCrashReport = ({
  error,
  componentStack,
  version,
}: BuildCrashReportParams): CrashReport => {
  const message = collapseHomePaths({ text: error.message });
  const title = `Crash: ${message.split('\n')[0] ?? 'runtime error'}`;
  const stack = componentStack === null ? '' : collapseHomePaths({ text: componentStack }).trim();
  const trace = capTrace({ trace: stack === '' ? '(no component stack was captured)' : stack });

  const body = [
    `Version: ${version === null || version === '' ? 'unknown' : version}`,
    '',
    'The app hit a runtime error and stopped rendering.',
    '',
    '**Error**',
    '```',
    message,
    '```',
    '',
    '**Component stack**',
    '```',
    trace,
    '```',
  ].join('\n');

  return {
    url: `${NEW_ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`,
    title,
    body,
  };
};
