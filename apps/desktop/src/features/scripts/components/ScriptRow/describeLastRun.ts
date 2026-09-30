import { formatAdaptiveAge } from '../../../../shared/utils/time/formatAdaptiveAge';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import type { ScriptRunRecord } from '../../scripts';

type LastRunGlyph = 'running' | 'passed' | 'failed' | 'stopped';

export type LastRun = {
  readonly glyph: LastRunGlyph;
  readonly word: string;
  readonly detail: string | null;
};

type Params = {
  readonly record: ScriptRunRecord | null;
  readonly now: number;
};

export const describeLastRun = ({ record, now }: Params): LastRun | null => {
  if (record === null || record.status === 'idle') {
    return null;
  }
  if (record.status === 'pending') {
    return {
      glyph: 'running',
      word: 'Running',
      detail: formatDuration({ durationMs: now - record.startedAt }),
    };
  }
  const finishedAt = record.completedAt ?? record.startedAt;
  const age = formatAdaptiveAge({ at: finishedAt, now });
  if (record.status === 'cancelled') {
    return { glyph: 'stopped', word: 'Stopped', detail: age };
  }
  if (record.status === 'error') {
    const exitCode = record.result?.exitCode ?? null;
    return {
      glyph: 'failed',
      word: exitCode === null ? 'Failed' : `Exit ${exitCode}`,
      detail: age,
    };
  }
  const duration =
    record.completedAt === undefined
      ? null
      : formatDuration({
          durationMs: record.completedAt - record.startedAt,
          hasTenths: true,
        });
  return {
    glyph: 'passed',
    word: duration ?? 'Passed',
    detail: age,
  };
};
