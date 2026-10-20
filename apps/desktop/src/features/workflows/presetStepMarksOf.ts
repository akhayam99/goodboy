import type { AutoContext } from '@goodboy/core';
import type { ProviderId, RoleModelPreferences, Step } from '@goodboy/types';
import {
  routingLabelParts,
  routingNameText,
} from '../../shared/components/RoutingPicker/routingSummary';
import { AGENT_KIND_META, classifyStep, type AgentKind } from '../session/agent-kind';
import { resolveStepRouting } from './resolveStepRouting';

export type PresetStepMark = {
  readonly key: string;
  readonly provider: ProviderId | null;
  readonly label: string;
  readonly kind: AgentKind;
  readonly roleName: string;
  readonly position: number;
  readonly total: number;
  readonly model: string;
  readonly effort: string | null;
  readonly instruction: string;
  readonly handsOn: string | null;
};

type Params = {
  readonly steps: ReadonlyArray<Step>;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly scope: AutoContext | null;
};

type StepParams = {
  readonly step: Step;
};

const AUTO_WORD = 'Auto';

const namesItsProvider = ({ step }: StepParams): boolean =>
  step.routingLock?.pick != null ||
  step.routingDecision?.selected != null ||
  step.providerOverride !== undefined;

const instructionOf = ({ step }: StepParams): string => {
  const prefix = step.promptPrefix.trim();
  return prefix === '' ? step.name.trim() : prefix;
};

export const presetStepMarksOf = ({
  steps,
  roleModels,
  sessionProvider,
  connectedProviders,
  scope,
}: Params): ReadonlyArray<PresetStepMark> => {
  const live = steps
    .filter((step) => step.deletedAt === undefined)
    .sort((left, right) => left.ordinal - right.ordinal);
  return live.map((step, index) => {
    const kind = classifyStep({ step });
    const routing = resolveStepRouting({ step, kind, roleModels, sessionProvider, scope });
    const isResolved = namesItsProvider({ step }) || connectedProviders.includes(routing.provider);
    const parts = isResolved
      ? routingLabelParts({
          provider: routing.provider,
          model: routing.model,
          effort: routing.effort,
        })
      : null;
    const model = parts === null ? AUTO_WORD : routingNameText(parts);
    const roleName = AGENT_KIND_META[kind].noun;
    return {
      key: step.id,
      provider: isResolved ? routing.provider : null,
      label: `Step ${index + 1} of ${live.length} ${roleName} · ${model}`,
      kind,
      roleName,
      position: index + 1,
      total: live.length,
      model,
      effort: parts === null || parts.detail.length === 0 ? null : parts.detail.join(' · '),
      instruction: instructionOf({ step }),
      handsOn: step.expectedOutput ?? AGENT_KIND_META[kind].expectedOutput,
    };
  });
};
