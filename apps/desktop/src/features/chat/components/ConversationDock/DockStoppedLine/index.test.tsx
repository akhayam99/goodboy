import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { DockStoppedLine } from '.';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-1' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

afterEach(cleanup);

describe('DockStoppedLine', () => {
  it('continues the tool the answer named, then says so', async () => {
    const retryBlockedTool = vi.fn(async () => undefined);
    store.setState({ retryBlockedTool });
    render(
      <DockStoppedLine
        sessionId={SESSION_ID}
        agentId={AGENT_ID}
        stopped={{ toolUseId: 'tu-7', toolName: 'Bash' }}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });

    expect(retryBlockedTool).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolName: 'Bash',
      toolUseId: 'tu-7',
    });
    screen.getByText('Continuing');
  });
});
