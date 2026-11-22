// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import { unmountFolderAction } from './unmountFolderAction';

const sessionId = brandId<SessionId>({ value: 'session-harborline' });
const mountId = brandId<MountId>({ value: 'mount-notify-relay' });

describe('unmountFolderAction', () => {
  it('asks to confirm, then unmounts that mount of that session', async () => {
    const unmount = vi.fn(async (_params: unknown) => ({ kept: false }));
    const action = unmountFolderAction({
      sessionId,
      mountId,
      projectName: 'notify-relay',
      unmountMount: unmount,
    });
    expect(action?.label).toBe('Unmount');
    expect(action?.requiresConfirm).toBe(true);
    await action?.run();
    expect(unmount).toHaveBeenCalledWith({ sessionId, mountId });
  });

  it('fails with a title that names the folder, and Retry unmounts again', async () => {
    const unmount = vi.fn(async (_params: unknown) => {
      throw new Error('a terminal is open in the folder');
    });
    const action = unmountFolderAction({
      sessionId,
      mountId,
      projectName: 'notify-relay',
      unmountMount: unmount,
    });
    expect(action?.failureTitle).toBe("Couldn't unmount notify-relay");
    await expect(action?.run()).rejects.toThrow('a terminal is open in the folder');
    await expect(action?.run()).rejects.toThrow('a terminal is open in the folder');
    expect(unmount).toHaveBeenCalledTimes(2);
  });
});
