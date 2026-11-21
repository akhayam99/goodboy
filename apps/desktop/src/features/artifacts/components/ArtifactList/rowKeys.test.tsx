// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { brandId, type ArtifactId, type IsoDateTime, type SessionId } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import type { ArtifactListRow } from '../../artifactListRows';
import { ArtifactList } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });

const aRow = (id: string, title: string): ArtifactListRow => ({
  id,
  target: { kind: 'artifact', artifactId: brandId<ArtifactId>({ value: id }) },
  kind: 'report',
  title,
  state: null,
  group: 'ready',
  at: brandId<IsoDateTime>({ value: '2026-09-30T10:00:00.000Z' }),
  deletedAt: null,
  partCount: 0,
  parts: [],
  runBy: null,
  isPlanRunning: false,
  isFaint: false,
});

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('ArtifactList row keys', () => {
  it('walks the rows with J and K and opens the one in focus with Enter', async () => {
    const onOpen = vi.fn();
    render(
      <ToastProvider>
        <ArtifactList
          sessionId={SESSION_ID}
          rows={[
            aRow('report-1', 'Rounding drift in ledger-core'),
            aRow('report-2', 'Retry storm in notify-relay'),
          ]}
          counts={{ all: 2, plan: 0, report: 2, wireframe: 0 }}
          filter="all"
          onFilterChange={vi.fn()}
          onOpen={onOpen}
          onImported={vi.fn()}
        />
      </ToastProvider>,
    );
    const user = userEvent.setup();

    await user.keyboard('j');
    expect(document.activeElement?.getAttribute('aria-label')).toContain('Rounding drift');
    await user.keyboard('j');
    expect(document.activeElement?.getAttribute('aria-label')).toContain('Retry storm');
    await user.keyboard('k');
    await user.keyboard('{Enter}');

    expect(onOpen).toHaveBeenCalledOnce();
  });
});
