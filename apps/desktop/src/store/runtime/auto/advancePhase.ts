import {
  getAutoTree,
  listAutoDelegations,
  listAutoOutbox,
  listOpenAutoDelegations,
  type AutoPhase,
  type AutoTree,
} from '@goodboy/db';
import type { AgentVerbContext } from './verbContext';

export type AdvancePhaseParams = Readonly<{
  ctx: AgentVerbContext;
  treeId: AutoTree['id'];
}>;

type TargetParams = {
  readonly tree: AutoTree;
  readonly openCount: number;
  readonly launchableCount: number;
  readonly pendingResultsCount: number;
  readonly pendingCount: number;
  readonly hasDelegations: boolean;
};

const targetPhaseOf = ({
  tree,
  openCount,
  launchableCount,
  pendingResultsCount,
  pendingCount,
  hasDelegations,
}: TargetParams): AutoPhase | null => {
  const idle = (): AutoPhase => {
    if (pendingCount > 0) {
      return 'merging';
    }
    if (openCount > 0) {
      return 'waiting';
    }
    return hasDelegations ? 'done' : 'answering';
  };
  switch (tree.phase) {
    case 'delegating':
      if (tree.activeRunId !== null || launchableCount > 0) {
        return null;
      }
      return pendingResultsCount > 0 ? 'merging' : idle();
    case 'waiting':
      if (pendingResultsCount > 0) {
        return 'merging';
      }
      return openCount === 0 ? idle() : null;
    case 'merging':
      return pendingCount === 0 ? idle() : null;
    case 'answering':
    case 'deciding':
    case 'done':
    case 'finished':
    case 'blocked':
    case 'stopping':
    case 'stopped':
      return null;
    default: {
      const unreachable: never = tree.phase;
      return unreachable;
    }
  }
};

type ReopenParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
};

const reopenStopped = async ({ ctx, tree }: ReopenParams): Promise<boolean> => {
  const pending = await listAutoOutbox({ db: ctx.db, treeId: tree.id, states: ['pending'] });
  if (!pending.some((row) => row.kind === 'user' && row.generation === tree.generation)) {
    return false;
  }
  const applied = await ctx.scheduler.transition({
    treeId: tree.id,
    expect: { phaseRev: tree.phaseRev, generation: tree.generation, from: ['stopped'] },
    to: 'answering',
    patch: { stopState: 'none', blockedReason: null },
  });
  return applied.kind === 'applied';
};

export const advancePhase = async ({ ctx, treeId }: AdvancePhaseParams): Promise<boolean> => {
  const isOwner = await ctx.scheduler.claim({ treeId });
  const tree = isOwner ? await getAutoTree({ db: ctx.db, treeId }) : null;
  if (tree === null) {
    return false;
  }
  if (tree.phase === 'stopped' && tree.stopState === 'confirmed') {
    return reopenStopped({ ctx, tree });
  }
  if (tree.stopState !== 'none') {
    return false;
  }
  const open = await listOpenAutoDelegations({ db: ctx.db, treeId });
  const all = await listAutoDelegations({ db: ctx.db, treeId });
  const pending = (await listAutoOutbox({ db: ctx.db, treeId, states: ['pending'] })).filter(
    (row) => row.generation === tree.generation,
  );
  const target = targetPhaseOf({
    tree,
    openCount: open.length,
    launchableCount: open.filter(
      (delegation) => delegation.state === 'accepted' || delegation.state === 'starting',
    ).length,
    pendingResultsCount: pending.filter((row) => row.kind === 'results').length,
    pendingCount: pending.length,
    hasDelegations: all.length > 0,
  });
  if (target === null || target === tree.phase) {
    return false;
  }
  const applied = await ctx.scheduler.transition({
    treeId,
    expect: { phaseRev: tree.phaseRev, generation: tree.generation, from: [tree.phase] },
    to: target,
  });
  return applied.kind === 'applied';
};
