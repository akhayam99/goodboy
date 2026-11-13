import { invokeCommand } from './invokeCommand';
import { BOOT_MARK_NAMES, type BootMarkName } from './bootMarkNames';
import { countPerf } from './countPerf';
import { PERF_COUNT_NAMES } from './perfCountNames';
import { formatBootReport, type BootMark } from './formatBootReport';

const MARK_PREFIX = 'launch.';
const REPORT_FALLBACK_MS = 10_000;
const NOT_REPORTED = 'not-reported';

let isReported = false;

type NameParams = {
  readonly name: BootMarkName;
};

const markOf = ({ name }: NameParams): BootMark | null => {
  const entry = performance.getEntriesByName(`${MARK_PREFIX}${name}`)[0];
  return entry === undefined ? null : { name, ms: entry.startTime };
};

const reportBoot = (): void => {
  if (isReported) {
    return;
  }
  isReported = true;
  const marks = BOOT_MARK_NAMES.flatMap((name) => markOf({ name }) ?? []);
  void invokeCommand('boot_breadcrumb', {
    phase: 'marks',
    detail: formatBootReport({ marks }),
  }).catch(() => NOT_REPORTED);
};

const reportWhenComplete = ({ name }: NameParams): void => {
  if (markOf({ name: 'splash' }) !== null && markOf({ name: 'board' }) !== null) {
    reportBoot();
    return;
  }
  if (name === 'splash') {
    window.setTimeout(reportBoot, REPORT_FALLBACK_MS);
  }
};

export const markBoot = ({ name }: NameParams): void => {
  if (typeof performance.mark !== 'function' || markOf({ name }) !== null) {
    return;
  }
  performance.mark(`${MARK_PREFIX}${name}`);
  countPerf({ name: PERF_COUNT_NAMES.bootMark, detail: name });
  if (name === 'splash' || name === 'board') {
    reportWhenComplete({ name });
  }
};
