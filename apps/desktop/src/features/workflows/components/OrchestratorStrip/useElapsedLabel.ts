import { useEffect, useState } from 'react';
import type { IsoDateTime } from '@goodboy/types';
import { formatDuration } from '../../../chat/utils/format-duration';

type Params = {
  readonly since: IsoDateTime | null;
};

const parseStart = (since: IsoDateTime | null): number | null => {
  if (since == null) {
    return null;
  }
  const parsed = Date.parse(since);
  return Number.isNaN(parsed) ? null : parsed;
};

const labelFor = (startedAtMs: number): string =>
  formatDuration({ durationMs: Math.max(0, Date.now() - startedAtMs) });

export const useElapsedLabel = ({ since }: Params): string | null => {
  const startedAtMs = parseStart(since);
  const [label, setLabel] = useState<string | null>(
    startedAtMs == null ? null : labelFor(startedAtMs),
  );

  useEffect(() => {
    if (startedAtMs == null) {
      setLabel(null);
      return;
    }
    setLabel(labelFor(startedAtMs));
    const handle = window.setInterval(() => setLabel(labelFor(startedAtMs)), 1_000);
    return () => window.clearInterval(handle);
  }, [startedAtMs]);

  return label;
};
