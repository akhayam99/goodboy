import type { RunRouteCloseness, Workflow } from '@goodboy/types';
import type { AutoLimitKind } from '../../../auto/autoLimitCopy';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { liveStepsOf } from './liveStepsOf';
import type { StartFormKind } from './startFormKinds';

type NoteParams = {
  readonly kind: StartFormKind | null;
  readonly workflow: Workflow | null;
  readonly closeness: RunRouteCloseness;
};

export const startFormNoteOf = ({ kind, workflow, closeness }: NoteParams): string | null => {
  if (kind === 'agent') {
    return START_KIND_COPY.plan.agentLine;
  }
  if (kind !== 'preset') {
    return START_KIND_COPY.plan.leadLine;
  }
  if (workflow === null) {
    return null;
  }
  const check = workflow.entryCheck?.trim() ?? '';
  if (check !== '') {
    return START_KIND_COPY.plan.checksFirst({
      name: workflow.name,
      check: `${check.charAt(0).toLowerCase()}${check.slice(1)}`,
    });
  }
  return closeness === 'follow'
    ? START_KIND_COPY.plan.followLine({ count: liveStepsOf({ workflow }).length })
    : START_KIND_COPY.plan.adaptLine({ name: workflow.name });
};

type LimitParams = {
  readonly kind: StartFormKind | null;
  readonly routeKind: AutoLimitKind | null;
};

export const startLimitKindOf = ({ kind, routeKind }: LimitParams): AutoLimitKind | null => {
  if (kind === null) {
    return routeKind;
  }
  return kind === 'agent' ? null : 'autoAgent';
};

export type StartAsksKind = 'level' | 'steps';

type AsksParams = {
  readonly kind: StartFormKind | null;
  readonly isAutoLead: boolean;
  readonly isPlan: boolean;
};

export const startAsksOf = ({ kind, isAutoLead, isPlan }: AsksParams): StartAsksKind | null => {
  if (kind === null) {
    if (isAutoLead) {
      return 'level';
    }
    return isPlan ? 'steps' : null;
  }
  return kind === 'agent' ? null : 'level';
};

export type StartGuidanceReader = keyof typeof START_KIND_COPY.guidance.readers;

export const startGuidanceReaderOf = ({
  kind,
  isAutoLead,
  isPlan,
}: AsksParams): StartGuidanceReader => {
  if (kind === null) {
    if (isPlan) {
      return 'orchestrator';
    }
    return isAutoLead ? 'auto' : 'agent';
  }
  return kind === 'agent' ? 'agent' : 'auto';
};

type ReasonParams = {
  readonly hasGoal: boolean;
};

export const startReasonOf = ({ hasGoal }: ReasonParams): string | null =>
  hasGoal ? null : START_KIND_COPY.goalNeeded;
