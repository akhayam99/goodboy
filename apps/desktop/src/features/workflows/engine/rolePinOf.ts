import type { AgentRole, ProviderId } from '@goodboy/types';
import type { StepDraft } from './types';

type Params = {
  readonly steps: ReadonlyArray<StepDraft>;
  readonly role: AgentRole;
};

type PinnedParams = {
  readonly step: StepDraft;
};

export type RolePin =
  | { readonly kind: 'follows' }
  | { readonly kind: 'pinned'; readonly provider: ProviderId; readonly model: string }
  | { readonly kind: 'mixed' };

const isPinned = ({ step }: PinnedParams): boolean => step.provider !== '' || step.model !== '';

export const rolePinOf = ({ steps, role }: Params): RolePin => {
  const ofRole = steps.filter((step) => step.role === role);
  const first = ofRole[0];
  if (first === undefined || !ofRole.some((step) => isPinned({ step }))) {
    return { kind: 'follows' };
  }
  const isSame = ofRole.every(
    (step) =>
      step.provider !== '' && step.provider === first.provider && step.model === first.model,
  );
  if (!isSame || first.provider === '') {
    return { kind: 'mixed' };
  }
  return { kind: 'pinned', provider: first.provider, model: first.model };
};
