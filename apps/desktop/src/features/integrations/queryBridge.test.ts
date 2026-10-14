// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { isQueryBridgeServing, queryBridgeAgentCommand } from './queryBridge';

describe('isQueryBridgeServing', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('reports what the backend answers', async () => {
    invoke.mockResolvedValueOnce(true);

    await expect(isQueryBridgeServing()).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith('query_bridge_serving');
  });

  it('reports a bridge that is not serving', async () => {
    invoke.mockResolvedValueOnce(false);

    await expect(isQueryBridgeServing()).resolves.toBe(false);
  });

  it('fails closed when the command cannot be reached', async () => {
    invoke.mockRejectedValueOnce(new Error('command not found'));

    await expect(isQueryBridgeServing()).resolves.toBe(false);
  });
});

describe('queryBridgeAgentCommand', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('returns the quoted absolute command the backend builds', async () => {
    invoke.mockResolvedValueOnce('"/Applications/Goodboy.app/Contents/MacOS/goodboy" query agent');

    await expect(queryBridgeAgentCommand()).resolves.toBe(
      '"/Applications/Goodboy.app/Contents/MacOS/goodboy" query agent',
    );
    expect(invoke).toHaveBeenCalledWith('query_bridge_agent_command');
  });

  it('returns null when the bridge is not serving or the command is unreachable', async () => {
    invoke.mockResolvedValueOnce(null);
    await expect(queryBridgeAgentCommand()).resolves.toBeNull();

    invoke.mockRejectedValueOnce(new Error('command not found'));
    await expect(queryBridgeAgentCommand()).resolves.toBeNull();
  });
});
