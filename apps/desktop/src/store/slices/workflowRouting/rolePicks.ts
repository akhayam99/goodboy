import { stepSizeForDifficulty, type HeadroomMap, type Resolution } from '@goodboy/core';
import type {
  AgentRole,
  ProviderId,
  SessionId,
  StepSize,
  WorkflowModelPick,
  WorkflowTaskProfile,
} from '@goodboy/types';
import { selectResolution } from '../models/selectResolution';
import type { AppStore } from '../../store';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly role: AgentRole;
  readonly size?: StepSize | null;
  readonly profile?: WorkflowTaskProfile | null;
  readonly providerPool?: ReadonlyArray<ProviderId> | null;
  readonly headroom?: HeadroomMap | null;
};

export type RolePicks = Readonly<{
  resolution: Resolution;
  roleDefault: WorkflowModelPick | null;
  kindDefault: WorkflowModelPick;
}>;

export const rolePicks = ({
  state,
  sessionId,
  role,
  size = null,
  profile = null,
  providerPool = null,
  headroom = null,
}: Params): RolePicks => {
  const resolution = selectResolution({
    state,
    sessionId,
    slot: { kind: 'role', id: role },
    size: size ?? (profile === null ? null : stepSizeForDifficulty(profile.difficulty)),
    providers: providerPool,
    headroom,
  });
  const pick: WorkflowModelPick = {
    provider: resolution.provider,
    model: resolution.model,
    effort: resolution.effort,
  };
  return {
    resolution,
    roleDefault: resolution.source === 'auto' ? null : pick,
    kindDefault: pick,
  };
};
