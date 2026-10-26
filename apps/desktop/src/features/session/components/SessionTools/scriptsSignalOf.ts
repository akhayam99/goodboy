import type { ScriptRunRecord } from '../../../scripts/scripts';
import type { ToolSignal } from './useToolSignal';

type Params = {
  readonly runs: Readonly<Record<string, ScriptRunRecord>> | undefined;
  readonly seen: Readonly<Record<string, string>> | undefined;
};

type CountParams = {
  readonly count: number;
  readonly what: string;
};

const countLabelOf = ({ count, what }: CountParams): string =>
  `${count} ${what}${count === 1 ? '' : 's'}`;

export const scriptsSignalOf = ({ runs, seen }: Params): ToolSignal | null => {
  const entries = Object.entries(runs ?? {});
  const failed = entries.filter(
    ([key, record]) => record.status === 'error' && seen?.[key] !== record.runId,
  );
  const running = entries.filter(([, record]) => record.status === 'pending');
  const firstFailed = failed[0];
  if (firstFailed !== undefined) {
    const [key, record] = firstFailed;
    return {
      kind: 'error',
      note:
        failed.length === 1
          ? `${record.name ?? key} failed. Open its output.`
          : `${countLabelOf({ count: failed.length, what: 'script' })} failed. Open their output.`,
    };
  }
  if (running.length === 0) {
    return null;
  }
  return {
    kind: 'running',
    note: `${countLabelOf({ count: running.length, what: 'script' })} running`,
  };
};
