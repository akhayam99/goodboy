import {
  buildIssueUrl,
  capIssueTitle,
  fitsIssueUrl,
  longestFittingPrefix,
  withoutLoneSurrogates,
} from './issueUrl';

export const CRASH_TRACE_BUDGET = 1500;

const MESSAGE_FIT_NOTICE = '\n[cut here: the rest of the message did not fit the report link]';

const TRACE_FIT_NOTICE = '\n[cut here: the rest of the stack did not fit the report link]';

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

type CrashBodyParams = {
  readonly version: string | null;
  readonly message: string;
  readonly trace: string;
};

const crashBody = ({ version, message, trace }: CrashBodyParams): string =>
  [
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

type FitCrashBodyParams = {
  readonly version: string | null;
  readonly title: string;
  readonly message: string;
  readonly trace: string;
};

const fitCrashBody = ({ version, title, message, trace }: FitCrashBodyParams): string => {
  const whole = crashBody({ version, message, trace });
  if (fitsIssueUrl({ title, body: whole })) {
    return whole;
  }

  const cutMessage = longestFittingPrefix({
    text: message,
    marker: MESSAGE_FIT_NOTICE,
    fits: ({ candidate }) =>
      fitsIssueUrl({ title, body: crashBody({ version, message: candidate, trace }) }),
  });
  const withCutMessage = crashBody({ version, message: cutMessage, trace });
  if (fitsIssueUrl({ title, body: withCutMessage })) {
    return withCutMessage;
  }

  const cutTrace = longestFittingPrefix({
    text: trace,
    marker: TRACE_FIT_NOTICE,
    fits: ({ candidate }) =>
      fitsIssueUrl({ title, body: crashBody({ version, message: cutMessage, trace: candidate }) }),
  });
  return crashBody({ version, message: cutMessage, trace: cutTrace });
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
  const message = withoutLoneSurrogates({ text: collapseHomePaths({ text: error.message }) });
  const title = capIssueTitle({ title: `Crash: ${message.split('\n')[0] ?? 'runtime error'}` });
  const stack =
    componentStack === null
      ? ''
      : withoutLoneSurrogates({ text: collapseHomePaths({ text: componentStack }) }).trim();
  const trace = capTrace({ trace: stack === '' ? '(no component stack was captured)' : stack });
  const body = fitCrashBody({ version, title, message, trace });

  return {
    url: buildIssueUrl({ title, body }),
    title,
    body,
  };
};
