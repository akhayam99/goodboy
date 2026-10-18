import { getAgentById } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { brandId, type ProviderRunId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { kindWritesFiles } from '../../../features/session/agent-kind';
import {
  acquireWorktreeWriter,
  cancelWorktreeWriter,
  holdsWorktreeWriter,
} from '../../../features/worktree/worktree';
import { resolveWorktreePath } from '../resolve/resolveWorktreePath';
import { selectMountById } from '../project-mounts/selectors';
import type { GetFn, SetFn, TurnLease, WithInput, TurnPhaseValue } from './types';
import { turnDone, turnReady } from './turnPhase';
import { NOT_BLOCKED } from './notBlocked';
import { acquireTurnWriteSet } from './acquireTurnWriteSet';
import { releaseTurnWriteSet } from './releaseTurnWriteSet';
import { resolveTurnWritableRoots } from './resolveTurnWritableRoots';
import { turnWriteSet } from './turnWriteSet';
import { isConfinedWriterRole } from './isConfinedWriterRole';
import { inPlaceSnapshot, type InPlaceSnapshotParams } from './inPlaceSnapshot';
import type { PreparedTurn } from './prepareTurn';
import type { RoutedTurn } from './routeTurn';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  lease: TurnLease;
  ctx: WithInput & PreparedTurn & RoutedTurn;
}>;

const FOLDER_LIST = new Intl.ListFormat('en', { type: 'conjunction' });

const beginInPlaceSnapshot = async ({ sessionId, runId, folders }: InPlaceSnapshotParams) => {
  try {
    return await inPlaceSnapshot.begin({ sessionId, runId, folders });
  } catch (error) {
    const names = FOLDER_LIST.format(folders.map((folder) => folder.name));
    throw new Error(
      `Couldn't save ${names} before this turn, so the agent did not start. ${formatError(error)}`,
    );
  }
};

export const leaseTurnWriter = async ({ set, get, lease, ctx }: Params) => {
  const { sessionId, override } = ctx.input;
  const {
    session,
    rewriterCopy,
    turnTarget,
    turnMountId,
    turnMountRevision,
    copyPath,
    inPlaceFolders,
    activeAgentId,
    resolvedPrompt,
    provider,
    model,
    turnAgentKind,
    rawEffort,
  } = ctx;
  const resolvedOverride =
    session.providerPreference.allowTurnOverride && override != null ? override : undefined;

  if (turnMountId !== null) {
    const capturedMount = selectMountById({ state: get(), sessionId, mountId: turnMountId });
    const isStillCaptured =
      capturedMount !== null &&
      capturedMount.worktreePath === turnTarget?.worktreePath &&
      (turnMountRevision === null || (capturedMount.revision ?? null) === turnMountRevision);
    if (!isStillCaptured) {
      throw new Error('the project mount this turn captured changed before it could start');
    }
  }

  if (turnAgentKind === 'rewriter' && rewriterCopy === null) {
    throw new Error('The copy this rewrite worked in is gone. Retry the rewrite from Activity.');
  }
  const isScribeTurn =
    turnAgentKind === 'scribe' && get().scribeAgents[activeAgentId] !== undefined;
  const isResolverTurn = turnAgentKind === 'resolver';
  const isCopyTurn = isResolverTurn && copyPath !== null;
  if (copyPath !== null && !isResolverTurn) {
    throw new Error('only a resolver can work in a copy of the branch');
  }
  const agentRowForLease = isResolverTurn
    ? ((get().sessionPhaseRuns[sessionId] ?? []).find((row) => row.id === activeAgentId) ??
      (await getAgentById(tauriDatabase, activeAgentId)))
    : null;
  const writerLeasePath =
    isResolverTurn && !isCopyTurn
      ? await resolveWorktreePath({ get, sessionId, target: turnTarget })
      : null;
  if (isResolverTurn && !isCopyTurn && (writerLeasePath === null || agentRowForLease === null)) {
    throw new Error(
      writerLeasePath === null
        ? 'resolver turn refused: the session has no worktree to lease'
        : 'resolver turn refused: the resolver agent is no longer on the session',
    );
  }
  if (writerLeasePath !== null && agentRowForLease !== null) {
    const wasHeldByCaller = holdsWorktreeWriter({
      path: writerLeasePath,
      holder: activeAgentId,
    });
    const granted = await acquireWorktreeWriter({
      path: writerLeasePath,
      holder: activeAgentId,
    });
    if (!granted.isGranted || granted.token === null) {
      await get().recordResolveAttempt({
        sessionId,
        agent: agentRowForLease,
        provider,
        model,
        effort: rawEffort,
        instructions: resolvedPrompt,
        phase: 'queued',
        mountTarget: turnTarget,
      });
      await cancelWorktreeWriter({ path: writerLeasePath, holder: activeAgentId });
      return turnDone({ result: { blockedOverBudget: false, isWriterLeaseDenied: true } });
    }
    lease.token = granted.token;
    if (!wasHeldByCaller) {
      lease.path = writerLeasePath;
      lease.holder = activeAgentId;
    }
  }
  const resolvedRoots = await resolveTurnWritableRoots({
    get,
    sessionId,
    workingDir: ctx.workingDir,
    rewriterCopyPath: rewriterCopy?.copyPath ?? null,
    copyPath,
  });
  const { isolatedCopyPath } = resolvedRoots;
  const isIsolatedTurn = isResolverTurn || rewriterCopy !== null || copyPath !== null;
  const isInPlaceWriter =
    !isIsolatedTurn &&
    inPlaceFolders.length > 0 &&
    (ctx.input.confinedRole === undefined
      ? kindWritesFiles({ kind: turnAgentKind })
      : isConfinedWriterRole({ role: ctx.input.confinedRole }));
  const writableRoots = isInPlaceWriter
    ? Array.from(
        new Set([
          ...resolvedRoots.writableRoots,
          ...inPlaceFolders
            .map((folder) => folder.rootPath)
            .filter((rootPath) => rootPath !== ctx.workingDir),
        ]),
      )
    : resolvedRoots.writableRoots;
  const isWriteSetTurn =
    !isIsolatedTurn && (isConfinedWriterRole({ role: ctx.input.confinedRole }) || isInPlaceWriter);
  let isReadOnlyAnswer = false;
  if (isWriteSetTurn) {
    await releaseTurnWriteSet({ get, sessionId, lease });
    const acquisition = await acquireTurnWriteSet({
      set,
      get,
      sessionId,
      agentId: activeAgentId,
      paths: turnWriteSet({ workingDir: ctx.workingDir, writableRoots }),
      lease,
    });
    if (acquisition === 'cancelled') {
      return turnDone({ result: NOT_BLOCKED });
    }
    if (acquisition === 'timed_out') {
      return turnDone({ result: { blockedOverBudget: false, isWriterLeaseDenied: true } });
    }
    isReadOnlyAnswer = acquisition === 'read_only';
  }
  const hasFolderLease = isInPlaceWriter && !isReadOnlyAnswer;
  const reservedRunId = hasFolderLease
    ? (ctx.input.runId ?? brandId<ProviderRunId>({ value: crypto.randomUUID() }))
    : null;
  const inPlaceCapture =
    reservedRunId === null
      ? null
      : await beginInPlaceSnapshot({ sessionId, runId: reservedRunId, folders: inPlaceFolders });
  const writeSetLease =
    lease.writeSetHolder === null || lease.writeSet.length === 0
      ? undefined
      : {
          holder: lease.writeSetHolder,
          entries: lease.writeSet.flatMap((entry) =>
            entry.token === null ? [] : [{ path: entry.path, token: entry.token }],
          ),
        };
  const writerLease =
    writerLeasePath === null || lease.token === null
      ? undefined
      : { path: writerLeasePath, holder: activeAgentId, token: lease.token };
  return turnReady({
    value: {
      resolvedOverride,
      isScribeTurn,
      isCopyTurn,
      writerLease,
      writeSetLease,
      writableRoots: isReadOnlyAnswer ? [] : writableRoots,
      isolatedCopyPath,
      isReadOnlyAnswer,
      hasFolderLease,
      reservedRunId,
      inPlaceCapture,
    },
  });
};

export type LeasedTurn = TurnPhaseValue<typeof leaseTurnWriter>;
