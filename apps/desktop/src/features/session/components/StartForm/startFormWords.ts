import type { AutoLimitKind } from '../../../auto/autoLimitCopy';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
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
  if (kind === 'agent') {
    return null;
  }
  return kind === 'auto' ? 'autoAgent' : kind;
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
  if (kind === 'auto') {
    return 'level';
  }
  return kind === 'agent' ? null : 'steps';
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
  if (kind === 'auto' || kind === 'agent') {
    return kind;
  }
  return 'orchestrator';
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

type LabelParams = {
  readonly kind: StartFormKind | null;
  readonly role: string;
};

export const startLabelOf = ({ kind, role }: LabelParams): string => {
  if (kind === null) {
    return RUN_ROUTE_COPY.start;
  }
  if (kind === 'agent') {
    return START_KIND_COPY.start.agent({ role });
  }
  return kind === 'auto' ? START_KIND_COPY.start.autoAgent : START_KIND_COPY.start[kind];
};
