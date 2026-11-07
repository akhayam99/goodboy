// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import type { TranscriptItem } from '../../utils/transcript-items';
import { dockFailureOf } from './dockFailureOf';
import { DockFailureLine } from './DockFailureLine';
import { lastFailureOf, type FailureItem } from './lastFailureOf';

const RUN = brandId<ProviderRunId>({ value: 'run-1' });
const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });

const failureItem = (overrides: Partial<FailureItem> = {}): FailureItem => ({
  kind: 'error',
  key: 'error-1',
  runId: RUN,
  message: 'pnpm could not reach the registry.',
  retryable: true,
  ...overrides,
});

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const noRetry = (): void => undefined;

describe('lastFailureOf', () => {
  it('reads the failure of the last turn, and none once you wrote again', () => {
    const failure = failureItem();
    const next: TranscriptItem = { kind: 'user_text', key: 'user-1', text: 'Again', at: AT };

    expect(lastFailureOf({ items: [failure] })).toBe(failure);
    expect(lastFailureOf({ items: [failure, next] })).toBeNull();
  });
});

describe('dockFailureOf', () => {
  it('asks nothing when the agent did not fail', () => {
    expect(
      dockFailureOf({ item: failureItem(), hasFailed: false, isRetrying: false, onRetry: noRetry }),
    ).toBeNull();
  });

  it('offers no Retry when the failure cannot be retried', () => {
    const shown = dockFailureOf({
      item: failureItem({ retryable: false }),
      hasFailed: true,
      isRetrying: false,
      onRetry: noRetry,
    });

    expect(shown?.retry).toBeNull();
  });

  it('retries the run that failed', () => {
    const onRetry = vi.fn();
    const shown = dockFailureOf({
      item: failureItem(),
      hasFailed: true,
      isRetrying: false,
      onRetry,
    });

    shown?.retry?.();
    expect(onRetry).toHaveBeenCalledWith({ runId: RUN, model: null });
  });
});

describe('DockFailureLine', () => {
  const failure = {
    message: 'pnpm could not reach the registry. Nothing was installed.',
    runId: RUN,
    isRetrying: false,
    retry: vi.fn(),
  };

  it('puts the reason on screen with one filled Retry', () => {
    render(<DockFailureLine failure={failure} />);

    screen.getByText('pnpm could not reach the registry. Nothing was installed.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(failure.retry).toHaveBeenCalledOnce();
  });

  it('stays busy while the retry runs', () => {
    render(<DockFailureLine failure={{ ...failure, isRetrying: true }} />);

    expect(screen.getByRole('button', { name: 'Retrying' }).hasAttribute('disabled')).toBe(true);
  });
});
