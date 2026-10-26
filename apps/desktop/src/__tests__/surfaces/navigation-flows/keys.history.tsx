import { expect, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { act, screen, waitFor } from '@testing-library/react';
import { branchPlace } from '../../../store/slices/navigation/place';
import { pressShortcut } from '../../helpers/pressKey';
import { branchTab, settle, useAppStore, WAIT, type Ctx, type Row } from './harness';

type Params = { readonly direction: 'undo' | 'redo' };
type KeyParams = Ctx;

const historyKeyRow = ({ direction }: Params): Row => ({
  name: `key history.${direction} restores a local backup on the Commits page`,
  covers: [`key:history.${direction}`],
  open: async ({ sessionId }: KeyParams) => {
    const mount = useAppStore.getState().sessionProjectMounts[sessionId]?.[0];
    if (mount === undefined) {
      throw new Error('The Harborline session needs a branch.');
    }
    useAppStore.setState((state) => ({
      sessionBranches: { ...state.sessionBranches, [sessionId]: mount.branch },
    }));
    useAppStore.getState().navigate({
      to: branchPlace({ sessionId, mountPath: mount.worktreePath, tab: 'commits' }),
    });
    await branchTab('commits')({ sessionId });
    await waitFor(() => {
      expect(useAppStore.getState().historyLiveSessions[mount.mountId]).toBeDefined();
      expect(useAppStore.getState().historyDrafts[mount.mountId]).toBeDefined();
      expect(useAppStore.getState().historyDrafts[mount.mountId]?.headSha).not.toBeNull();
    }, WAIT);
    await act(async () => {
      useAppStore.setState((state) => {
        const live = state.historyLiveSessions[mount.mountId];
        const draft = state.historyDrafts[mount.mountId];
        if (live === undefined || draft?.headSha === null || draft === undefined) {
          throw new Error('The Commits page needs loaded history.');
        }
        return {
          historyLiveSessions: {
            ...state.historyLiveSessions,
            [mount.mountId]: {
              ...live,
              [direction]: [
                {
                  identity: {
                    branch: mount.branch,
                    worktreePath: mount.worktreePath,
                    projectId: mount.projectId,
                  },
                  head: draft.headSha,
                  backupRef: 'refs/goodboy/backup/harborline/keys',
                  threadShas: [],
                  reciprocalThreadShas: [],
                },
              ],
            },
          },
        };
      });
    });
    const anchor = await screen.findByRole('button', { name: /^Search or run \(/ });
    anchor.focus();
    pressShortcut({ id: direction === 'undo' ? 'history.undo' : 'history.redo', target: anchor });
    await settle();
  },
  lands: async ({ sessionId }: KeyParams) => {
    const mount = useAppStore.getState().sessionProjectMounts[sessionId]?.[0];
    if (mount === undefined) {
      throw new Error('The Harborline session needs a branch.');
    }
    await waitFor(() => {
      const live = useAppStore.getState().historyLiveSessions[mount.mountId];
      expect(live?.[direction]).toEqual([]);
      expect(live?.[direction === 'undo' ? 'redo' : 'undo']).toHaveLength(1);
      expect(live?.error).toBeNull();
    }, WAIT);
    expect(vi.mocked(invoke).mock.calls).toContainEqual([
      'history_restore',
      expect.objectContaining({
        args: expect.objectContaining({
          branch: mount.branch,
          worktreePath: mount.worktreePath,
          backupRef: 'refs/goodboy/backup/harborline/keys',
          isLive: true,
        }),
      }),
    ]);
  },
});

export const HISTORY_KEY_ROWS: ReadonlyArray<Row> = [
  historyKeyRow({ direction: 'undo' }),
  historyKeyRow({ direction: 'redo' }),
];
