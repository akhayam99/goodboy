import type { AutoLimitKind } from '../../../auto/autoLimitCopy';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { startShapeOfFormKind, type StartFormKind } from './startFormKinds';

type HintParams = {
  readonly kind: StartFormKind | null;
};

export const startFormHintOf = ({ kind }: HintParams): string =>
  kind === null
    ? START_KIND_COPY.pickLine
    : START_KIND_COPY.shapes[startShapeOfFormKind({ kind })].what;

export const startFormNoteOf = ({ kind }: HintParams): string | null =>
  kind === null ? null : START_KIND_COPY.shapes[startShapeOfFormKind({ kind })].whileRuns;

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
  readonly kind: StartFormKind | null;
  readonly hasPreset: boolean;
};

export const startReasonOf = ({ hasGoal, kind, hasPreset }: ReasonParams): string | null => {
  if (!hasGoal) {
    return START_KIND_COPY.goalNeeded;
  }
  return kind === 'preset' && !hasPreset ? START_KIND_COPY.presetNeeded : null;
};
