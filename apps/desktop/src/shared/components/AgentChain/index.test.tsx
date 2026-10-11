// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore } from '../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { AgentChain } from './index';

const SESSION = aSession();
const FIRST_ID: AgentId = JSON.parse(JSON.stringify('agent-a'));
const SECOND_ID: AgentId = JSON.parse(JSON.stringify('agent-b'));

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

afterEach(cleanup);

describe('AgentChain', () => {
  it('keeps two launches with the same step name as separate rows without a key warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const first = anAgent({ id: FIRST_ID, sessionId: SESSION.id, name: 'Implementer' });
    const second = anAgent({ id: SECOND_ID, sessionId: SESSION.id, name: 'Implementer' });
    render(
      <AgentChain
        sessionId={SESSION.id}
        steps={[
          { name: 'Implementer', agent: first, isRunning: false },
          { name: 'Implementer', agent: second, isRunning: true },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const keyWarnings = error.mock.calls.filter((call) => String(call[0]).includes('same key'));
    expect(keyWarnings).toHaveLength(0);
    error.mockRestore();
  });
});
