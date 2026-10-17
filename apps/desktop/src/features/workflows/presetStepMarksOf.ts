import type { ProviderId, RoleModelPreferences, Step } from '@goodboy/types';
import { modelLabel } from '../chat/utils/chat-constants';
import { AGENT_KIND_META, classifyStep } from '../session/agent-kind';
import { resolveStepRouting } from './resolveStepRouting';

export type PresetStepMark = {
  readonly key: string;
  readonly provider: ProviderId | null;
  readonly label: string;
};

type Params = {
  readonly steps: ReadonlyArray<Step>;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
};

type StepParams = {
  readonly step: Step;
};

const AUTO_WORD = 'Auto';

const namesItsProvider = ({ step }: StepParams): boolean =>
  step.routingLock?.pick != null ||
  step.routingDecision?.selected != null ||
  step.providerOverride !== undefined;

export const presetStepMarksOf = ({
  steps,
  roleModels,
  sessionProvider,
  connectedProviders,
}: Params): ReadonlyArray<PresetStepMark> =>
  [...steps]
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((step, index) => {
      const kind = classifyStep({ step });
      const routing = resolveStepRouting({ step, kind, roleModels, sessionProvider });
      const isResolved =
        namesItsProvider({ step }) || connectedProviders.includes(routing.provider);
      const model = isResolved ? modelLabel(routing.model, routing.provider) : AUTO_WORD;
      return {
        key: step.id,
        provider: isResolved ? routing.provider : null,
        label: `Step ${index + 1} ${AGENT_KIND_META[kind].noun} · ${model}`,
      };
    });
