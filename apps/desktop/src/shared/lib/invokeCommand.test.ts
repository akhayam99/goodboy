import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));

import { CommandError, invokeCommand, toCommandError } from './invokeCommand';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('invokeCommand', () => {
  it('resolves with the command result', async () => {
    h.invoke.mockResolvedValueOnce(['ledger-core']);

    await expect(invokeCommand<string[]>('project_list', { workspaceId: 'w-1' })).resolves.toEqual([
      'ledger-core',
    ]);
    expect(h.invoke).toHaveBeenCalledWith('project_list', { workspaceId: 'w-1' });
  });

  it('turns a {kind, message} rejection into a CommandError', async () => {
    h.invoke.mockRejectedValueOnce({ kind: 'io', message: 'the folder is locked' });

    const error = await invokeCommand('project_move').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CommandError);
    expect(error).toMatchObject({ kind: 'io', message: 'the folder is locked' });
  });

  it('turns a string rejection into an unknown-kind CommandError', async () => {
    h.invoke.mockRejectedValueOnce('gh is not installed');

    const error = await invokeCommand('gh_status').catch((caught: unknown) => caught);

    expect(error).toMatchObject({ kind: 'unknown', message: 'gh is not installed' });
  });
});

describe('toCommandError', () => {
  it('keeps a CommandError as it is', () => {
    const original = new CommandError({ kind: 'db', message: 'locked' });

    expect(toCommandError(original)).toBe(original);
  });

  it('wraps an Error and keeps it as the cause', () => {
    const original = new Error('boom');

    const error = toCommandError(original);

    expect(error).toMatchObject({ kind: 'unknown', message: 'boom' });
    expect(error.cause).toBe(original);
  });

  it('never renders an object without a message as an object dump', () => {
    expect(toCommandError({ code: 42 }).message).toBe('{"code":42}');
  });

  it('serializes to the wire shape', () => {
    const error = new CommandError({ kind: 'db', message: 'locked' });

    expect(JSON.parse(JSON.stringify(error))).toEqual({ kind: 'db', message: 'locked' });
  });
});
