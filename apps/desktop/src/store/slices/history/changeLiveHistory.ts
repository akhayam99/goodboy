import { formatError } from '@goodboy/ui';
import { readLiveHistoryOutcome } from './readLiveHistoryOutcome';
import { historyDraftReads } from './historyDraftReads';
import { recordHistoryEvent } from './recordHistoryEvent';
import { historyThreadSnapshots } from './historyThreadSnapshots';
import { refreshWorktreeStatuses } from '../worktreeStatuses/cache';
import type { SliceDeps } from '../../slice-types';
import { historyTargetOf } from './historyTargetOf';
import { identityChange, identityOf } from './historyIdentity';
import { isHistoryRunActive } from './isHistoryRunActive';
import { remapRewrittenCommits } from './remapRewrittenCommits';
import { setHistoryRun } from './setHistoryRun';
import type {
  ChangeLiveHistoryInput,
  HistoryLiveRequest,
  HistoryLiveSession,
  HistoryThreadShas,
  HistoryTarget,
} from './types';

type PatchParams = { readonly patch: Partial<HistoryLiveSession> };

export const changeLiveHistory =
  ({ set, get }: SliceDeps) =>
  async ({
    sessionId,
    mountId,
    items,
    onto,
    sha,
    direction,
    shouldRetry = false,
    shouldStash = false,
  }: ChangeLiveHistoryInput): Promise<boolean> => {
    const live = get().historyLiveSessions[mountId];
    const draft = get().historyDrafts[mountId];
    const run = get().historyRuns[mountId];
    if (
      live === undefined ||
      live.isBusy ||
      draft === undefined ||
      draft.sessionId !== sessionId ||
      (run !== undefined && isHistoryRunActive({ phase: run.phase }))
    ) {
      return false;
    }
    const patch = ({ patch: update }: PatchParams): void => {
      set((state) => {
        const current = state.historyLiveSessions[mountId];
        if (current?.token !== live.token) {
          return state;
        }
        return {
          historyLiveSessions: {
            ...state.historyLiveSessions,
            [mountId]: { ...current, ...update },
          },
        };
      });
    };
    let target: HistoryTarget;
    try {
      target = historyTargetOf({ get, sessionId, mountId });
    } catch (error) {
      patch({ patch: { error: formatError(error) } });
      return false;
    }
    const entry = direction === undefined ? null : (live[direction].at(-1) ?? null);
    if (!shouldRetry && items === undefined && entry === null) {
      return false;
    }
    const request: HistoryLiveRequest | null = shouldRetry
      ? live.pending
      : {
          busySha: sha ?? draft.commits[0]?.sha ?? null,
          identity: entry?.identity ?? identityOf({ target }),
          expectedHead: entry?.head ?? draft.headSha,
          direction: direction ?? 'edit',
          entry,
          plan:
            items === undefined
              ? null
              : {
                  worktreePath: target.worktreePath,
                  base: draft.baseSha,
                  head: draft.headSha,
                  steps: items,
                  onto: onto ?? null,
                },
        };
    if (request === null) {
      return false;
    }
    const previousThreads: ReadonlyArray<HistoryThreadShas> = (
      get().sessionResolveThreads[sessionId] ?? []
    ).map((thread) => ({
      threadId: thread.threadId,
      commitShas: thread.commitShas ?? [],
      fixupOfSha: thread.fixupOfSha,
      replacesSha: thread.replacesSha,
    }));
    historyDraftReads.cancel({ key: mountId });
    patch({
      patch: {
        isBusy: true,
        busySha: request.busySha,
        error: null,
        shouldStashFiles: false,
        hasConflict: false,
        pending: request,
      },
    });
    let hasMoved = false;
    try {
      const changed = identityChange({ get, sessionId, mountId, identity: request.identity });
      if (changed !== null) {
        throw new Error(changed);
      }
      const result = await readLiveHistoryOutcome({ request, shouldStash });
      if (result.kind === 'blocked') {
        throw new Error(result.reason);
      }
      if (result.kind === 'stopped') {
        const stop = result.result.stop;
        patch({
          patch: {
            error:
              stop === null
                ? 'The edit did not pass its checks. Nothing was changed.'
                : stop.kind === 'merge'
                  ? `The edit conflicts in ${stop.files.join(', ')}. Nothing was changed.`
                  : `A hook stopped the edit: ${stop.message}. Nothing was changed.`,
            hasConflict: stop?.kind === 'merge',
          },
        });
        return false;
      }
      const { outcome, map } = result;
      if (outcome.kind === 'needs-stash') {
        patch({
          patch: {
            shouldStashFiles: true,
            error: `Your uncommitted files overlap this edit: ${outcome.files.join(', ')}.`,
          },
        });
        return false;
      }
      if (outcome.kind === 'busy') {
        throw new Error(
          `${outcome.holder ?? 'An agent'} is writing here. Try again when it finishes.`,
        );
      }
      if (outcome.kind === 'blocked') {
        throw new Error(outcome.reason);
      }
      if (outcome.kind === 'head-moved') {
        throw new Error('The branch moved. Refresh before editing again.');
      }
      if (outcome.kind === 'set-aside') {
        setHistoryRun({
          set,
          sessionId,
          mountId,
          origin: 'plan',
          patch: {
            phase: 'set-aside',
            savedStash: {
              sha: outcome.stash,
              identity: request.identity,
              expectedHead: request.expectedHead,
              files: [],
            },
          },
        });
        throw new Error(outcome.reason);
      }
      if (outcome.kind === 'files-restored') {
        return false;
      }
      hasMoved = true;
      const snapshots = historyThreadSnapshots({ threadShas: previousThreads, map });
      const reciprocal = {
        identity: request.identity,
        backupRef: outcome.backupRef,
        head: outcome.head,
        threadShas: request.entry?.reciprocalThreadShas ?? snapshots.before,
        reciprocalThreadShas: request.entry?.threadShas ?? snapshots.after,
      };
      const isCurrent = (): boolean =>
        get().historyLiveSessions[mountId]?.token === live.token &&
        identityChange({ get, sessionId, mountId, identity: request.identity }) === null;
      if (isCurrent()) {
        const undo =
          request.direction === 'undo' ? live.undo.slice(0, -1) : [...live.undo, reciprocal];
        const redo =
          request.direction === 'edit'
            ? []
            : request.direction === 'redo'
              ? live.redo.slice(0, -1)
              : [...live.redo, reciprocal];
        patch({ patch: { undo, redo, pending: null } });
        setHistoryRun({
          set,
          sessionId,
          mountId,
          origin: 'plan',
          patch: {
            phase: 'applied',
            movedHead: outcome.head,
            backupRef: outcome.backupRef,
            identity: request.identity,
            stop: null,
            applied: null,
            result: null,
          },
        });
      }
      await recordHistoryEvent({
        get,
        target,
        origin: 'plan',
        planId: null,
        kind: request.direction === 'undo' ? 'history_restored' : 'history_rewritten',
        extra: { backupRef: outcome.backupRef },
      });
      if (request.direction === 'edit') {
        await remapRewrittenCommits({ set, get, sessionId, map, shouldRequireSaved: true });
      }
      if (request.direction !== 'edit') {
        for (const thread of request.entry?.threadShas ?? []) {
          const hasSaved = await get().updateResolveThread({
            sessionId,
            threadId: thread.threadId,
            patch: {
              commitShas: thread.commitShas,
              fixupOfSha: thread.fixupOfSha,
              replacesSha: thread.replacesSha,
            },
          });
          if (!hasSaved) {
            throw new Error(
              'The branch changed, but its comment references could not be restored.',
            );
          }
        }
      }
      if (!isCurrent()) {
        return false;
      }
      if (outcome.kind === 'restore-conflict') {
        setHistoryRun({
          set,
          sessionId,
          mountId,
          origin: 'plan',
          patch: {
            phase: 'restore-conflict',
            savedStash: {
              sha: outcome.stash,
              identity: request.identity,
              expectedHead: outcome.head,
              files: outcome.files,
            },
          },
        });
        patch({ patch: { error: 'The history changed. Your saved files need attention.' } });
      }
      if (outcome.kind === 'moved' && outcome.cleanupError !== undefined) {
        patch({ patch: { error: outcome.cleanupError } });
      }
    } catch (error) {
      patch({ patch: { error: formatError(error) } });
    } finally {
      if (hasMoved) {
        try {
          await refreshWorktreeStatuses({ worktreePaths: [request.identity.worktreePath] });
          if (
            get().historyLiveSessions[mountId]?.token === live.token &&
            identityChange({ get, sessionId, mountId, identity: request.identity }) === null
          ) {
            await get().loadHistoryDraft({ sessionId, mountId });
          }
        } catch (error) {
          patch({ patch: { error: formatError(error) } });
        }
      }
      patch({ patch: { isBusy: false, busySha: null } });
    }
    return hasMoved;
  };
