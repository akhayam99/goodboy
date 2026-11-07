// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  brandId,
  type IsoDateTime,
  type SessionExternalTask,
  type SessionExternalTaskProvider,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { importStore, resetStoryStore } from '../../../../../../../store/storyHarness';
import { FocusedTaskBody } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const PROVIDERS: ReadonlyArray<SessionExternalTaskProvider> = [
  'linear',
  'github',
  'gitlab',
  'jira',
  'slack',
  'sentry',
  'bitbucket',
];
beforeAll(async () => {
  await importStore();
});
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(cleanup);

describe('Disconnected linked record', () => {
  it.each(PROVIDERS)(
    'keeps %s readable with one connection line and its provider link',
    (provider) => {
      const task: SessionExternalTask = {
        sessionId: SESSION_ID,
        provider,
        externalId: '42',
        identifier: 'HAR-42',
        title: 'Keep the retry record',
        url: 'https://example.test/harborline/42',
        createdAt: brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' }),
      };
      render(
        <FocusedTaskBody
          provider={provider}
          sessionId={SESSION_ID}
          workspaceId={WORKSPACE_ID}
          task={task}
          isConnected={false}
        />,
      );
      screen.getByRole('heading', { name: task.title });
      expect(
        screen.getAllByText(
          'Connection lost. Open the record in its provider or reconnect in Settings.',
        ),
      ).toHaveLength(1);
      screen.getByRole('button', { name: 'Open HAR-42' });
    },
  );
});
