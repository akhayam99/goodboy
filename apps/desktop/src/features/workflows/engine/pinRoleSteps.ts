import type { AgentRole, ProviderId } from '@goodboy/types';
import type { StepDraft } from './types';

type Params = {
  readonly steps: ReadonlyArray<StepDraft>;
  readonly role: AgentRole;
  readonly route: { readonly provider: ProviderId; readonly model: string } | null;
};

export const pinRoleSteps = ({ steps, role, route }: Params): ReadonlyArray<StepDraft> =>
  steps.map((step) =>
    step.role === role
      ? {
          ...step,
          provider: route === null ? '' : route.provider,
          model: route === null ? '' : route.model,
        }
      : step,
  );
