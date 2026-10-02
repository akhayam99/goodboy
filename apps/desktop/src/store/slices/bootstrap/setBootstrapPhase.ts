import type { BootstrapPhase, IsoDateTime, ProjectId } from '@goodboy/types';
import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from '../../slice-types';
import {
  bootstrapPhaseKey,
  canMoveStage,
  freshBootstrapPhase,
  serializeBootstrapPhase,
} from './phase';

type Input = {
  readonly projectId: ProjectId;
  readonly patch: Partial<Omit<BootstrapPhase, 'updatedAt'>>;
};

export const setBootstrapPhase = (set: SetFn, get: GetFn) => {
  return async ({ projectId, patch }: Input): Promise<BootstrapPhase> => {
    const now = new Date().toISOString() as IsoDateTime;
    const current = get().bootstrapPhase[projectId] ?? freshBootstrapPhase(now);
    const nextStage = patch.stage ?? current.stage;
    if (!canMoveStage({ from: current.stage, to: nextStage })) {
      throw new Error(`the ${current.stage} phase cannot go back to ${nextStage}`);
    }
    const next: BootstrapPhase = { ...current, ...patch, stage: nextStage, updatedAt: now };
    await setSetting(tauriDatabase, bootstrapPhaseKey(projectId), serializeBootstrapPhase(next));
    set((state) => ({ bootstrapPhase: { ...state.bootstrapPhase, [projectId]: next } }));
    return next;
  };
};
