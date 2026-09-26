import { useEffect, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { nextSweepRecord, shouldSweep } from '../../updateSweepGate';
import type { UpdateSweepRecord } from '../../updateSweepGate';

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const readRecord = (): UpdateSweepRecord | null => {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.updateSweep);
    if (raw === null) {
      return null;
    }
    const parsed = JSON.parse(raw) as UpdateSweepRecord;
    if (
      typeof parsed.lastSweepAt !== 'number' ||
      typeof parsed.dayKey !== 'string' ||
      typeof parsed.countToday !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeRecord = (record: UpdateSweepRecord): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.updateSweep, JSON.stringify(record));
  } catch {
    return;
  }
};

type Params = {
  readonly active: boolean;
};

export const useUpdateSweep = ({ active }: Params): number | null => {
  const [sweepKey, setSweepKey] = useState<number | null>(null);
  const hasSweptOnArrival = useRef(false);

  const trigger = (): void => {
    if (prefersReducedMotion()) {
      return;
    }
    const now = Date.now();
    const record = readRecord();
    if (!shouldSweep({ nowMs: now, record })) {
      return;
    }
    writeRecord(nextSweepRecord({ nowMs: now, record }));
    setSweepKey(now);
  };

  useEffect(() => {
    if (!active || hasSweptOnArrival.current) {
      return;
    }
    hasSweptOnArrival.current = true;
    trigger();
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }
    window.addEventListener('focus', trigger);
    return () => {
      window.removeEventListener('focus', trigger);
    };
  }, [active]);

  return sweepKey;
};
