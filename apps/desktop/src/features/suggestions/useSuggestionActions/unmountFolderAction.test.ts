// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { aMountView } from '../../session/testing/aMountView';
import { unmountFolderAction } from './unmountFolderAction';

const sessionId = brandId<SessionId>({ value: 'session-harborline' });
const mountId = brandId<MountId>({ value: 'mount-notify-relay' });

const UNMOUNTED = {
  ...aMountView({
    key: 'notify-relay',
    sessionId,
    projectId: brandId<ProjectId>({ value: 'project-notify-relay' }),
    projectName: 'notify-relay',
    branch: '',
    isAttached: false,
  }),
  revision: 4,
};

type Overrides = {
  readonly unmountMount?: AppStore['unmountMount'];
  readonly attachMount?: AppStore['attachMount'];
};

const setup = ({ unmountMount, attachMount }: Overrides = {}) => {
  const undos: Array<Parameters<AppStore['undoable']>[0]['undo']> = [];
  const unmount = vi.fn(
    unmountMount ?? (async () => ({ mount: UNMOUNTED, kept: false, reason: null })),
  );
  const attach = vi.fn(attachMount ?? (async () => UNMOUNTED));
  const undoable = vi.fn((params: Parameters<AppStore['undoable']>[0]) => {
    undos.push(params.undo);
    return 'undo-notify-relay';
  });
  const action = unmountFolderAction({
    sessionId,
    mountId,
    projectName: 'notify-relay',
    unmountMount: unmount,
    attachMount: attach,
    undoable,
  });
  return { action, unmount, attach, undoable, undos };
};

const conflict = () => Object.assign(new Error('the mount changed'), { code: 'revision-conflict' });

describe('unmountFolderAction', () => {
  it('asks to confirm, then unmounts that mount of that session', async () => {
    const { action, unmount } = setup();
    expect(action?.label).toBe('Unmount');
    expect(action?.requiresConfirm).toBe(true);
    await action?.run();
    expect(unmount).toHaveBeenCalledWith({ sessionId, mountId });
  });

  it('fails with a title that names the folder, and Retry unmounts again', async () => {
    const { action, unmount, undoable } = setup({
      unmountMount: async () => {
        throw new Error('a terminal is open in the folder');
      },
    });
    expect(action?.failureTitle).toBe("Couldn't unmount notify-relay");
    await expect(action?.run()).rejects.toThrow('a terminal is open in the folder');
    await expect(action?.run()).rejects.toThrow('a terminal is open in the folder');
    expect(unmount).toHaveBeenCalledTimes(2);
    expect(undoable).not.toHaveBeenCalled();
  });

  it('offers Undo, which attaches the same folder again at the unmounted revision', async () => {
    const { action, attach, undoable, undos } = setup();
    await action?.run();

    expect(undoable).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unmounted notify-relay.' }),
    );
    expect(await undos[0]?.()).toBe(true);
    expect(attach).toHaveBeenCalledWith({ sessionId, mountId, expectedRevision: 4 });
  });

  it('Undo refuses when the folder changed since it was unmounted', async () => {
    const { action, undos } = setup({
      attachMount: async () => {
        throw conflict();
      },
    });
    await action?.run();

    expect(await undos[0]?.()).toBe(false);
  });

  it('Undo throws a failed attach so it stays on the stack for a retry', async () => {
    let attempts = 0;
    const { action, attach, undos } = setup({
      attachMount: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('the folder is busy');
        }
        return UNMOUNTED;
      },
    });
    await action?.run();

    await expect(undos[0]?.()).rejects.toThrow('the folder is busy');
    expect(await undos[0]?.()).toBe(true);
    expect(attach).toHaveBeenCalledTimes(2);
  });
});
