import { getAgentById } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  acquireWorktreeWriter,
  cancelWorktreeWriter,
  holdsWorktreeWriter,
} from '../../../features/worktree/worktree';
import { resolveWorktreePath } from '../resolve/resolveWorktreePath';
import { selectMountById } from '../project-mounts/selectors';
import type { GetFn, TurnLease, WithInput, TurnPhaseValue } from './types';
import { turnDone, turnReady } from './turnPhase';
import type { PreparedTurn } from './prepareTurn';
import type { RoutedTurn } from './routeTurn';

type Params = Readonly<{
  get: GetFn;
  lease: TurnLease;
  ctx: WithInput & PreparedTurn & RoutedTurn;
}>;

export const leaseTurnWriter = async ({ get, lease, ctx }: Params) => {
  const { sessionId, override } = ctx.input;
  const {
    session,
    rewriterCopy,
    turnTarget,
    turnMountId,
    turnMountRevision,
    copyPath,
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
  const writerLease =
    writerLeasePath === null || lease.token === null
      ? undefined
      : { path: writerLeasePath, holder: activeAgentId, token: lease.token };
  return turnReady({ value: { resolvedOverride, isScribeTurn, isCopyTurn, writerLease } });
};

export type LeasedTurn = TurnPhaseValue<typeof leaseTurnWriter>;
