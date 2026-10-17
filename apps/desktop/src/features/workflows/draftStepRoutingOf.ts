import type { AutoContext } from '@goodboy/core';
import type { ProviderId, RoleModelPreferences } from '@goodboy/types';
import { classifyStep } from '../session/agent-kind';
import type { StepDraft } from './engine/types';
import { resolveStepRouting, type RoutedStep } from './resolveStepRouting';

type Params = {
  readonly draft: StepDraft;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly scope: AutoContext | null;
  readonly isPinKept?: boolean;
};

type DraftRouting = {
  readonly provider: ProviderId;
  readonly model: string;
};

type RoutedParams = {
  readonly draft: StepDraft;
  readonly isPinKept: boolean;
};

const routedStepOf = ({ draft, isPinKept }: RoutedParams): RoutedStep => {
  const isPinned = isPinKept && (draft.provider !== '' || draft.model !== '');
  return {
    role: draft.role,
    ...(draft.size !== null && { size: draft.size }),
    ...(isPinKept && draft.provider !== '' && { providerOverride: draft.provider }),
    ...(isPinKept && draft.model !== '' && { modelOverride: draft.model }),
    routingLock: isPinned ? null : (draft.routingLock ?? null),
    routingDecision: isPinned ? null : (draft.routingDecision ?? null),
  };
};

export const draftStepRoutingOf = ({
  draft,
  roleModels,
  sessionProvider,
  scope,
  isPinKept = true,
}: Params): DraftRouting => {
  const routing = resolveStepRouting({
    step: routedStepOf({ draft, isPinKept }),
    kind: classifyStep({ step: draft }),
    roleModels,
    sessionProvider,
    scope,
  });
  return { provider: routing.provider, model: routing.model };
};
