import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { brandId, type ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from '../../../utils/transcript-items';
import { useDockFailure } from './index';

const RUN = brandId<ProviderRunId>({ value: 'run-limit' });

const FAILED: ReadonlyArray<TranscriptItem> = [
  { kind: 'error', key: 'error-1', message: 'Usage limit reached', runId: RUN, retryable: true },
];

describe('useDockFailure', () => {
  it('names the failing run as the dock owned run while the dock draws the failure', () => {
    const { result } = renderHook(() =>
      useDockFailure({
        items: FAILED,
        isInDock: true,
        hasFailed: true,
        retryingRunId: null,
        retry: vi.fn(async () => undefined),
      }),
    );

    expect(result.current.failure?.runId).toBe(RUN);
    expect(result.current.errorDock).toEqual({ runId: RUN });
  });

  it('owns no run when another row owns the failure, so a limit stop keeps its Continue row', () => {
    const { result } = renderHook(() =>
      useDockFailure({
        items: FAILED,
        isInDock: true,
        hasFailed: false,
        retryingRunId: null,
        retry: vi.fn(async () => undefined),
      }),
    );

    expect(result.current.failure).toBeNull();
    expect(result.current.errorDock).toEqual({ runId: null });
  });

  it('draws no dock failure outside a dock', () => {
    const { result } = renderHook(() =>
      useDockFailure({
        items: FAILED,
        isInDock: false,
        hasFailed: true,
        retryingRunId: null,
        retry: vi.fn(async () => undefined),
      }),
    );

    expect(result.current.failure).toBeNull();
    expect(result.current.errorDock).toBeNull();
  });
});
