import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import {
  START_AGENT_CHOICE,
  RUN_ORCHESTRATOR_CHOICE,
  RUN_WORKFLOW_CHOICE,
} from '../../../../shared/lib/startCopy';

export type RunsAs = 'workflow' | 'orchestrate' | 'agent';

type RunsAsOption = {
  readonly value: RunsAs;
  readonly label: string;
  readonly icon: LucideIcon;
};

export const RUNS_AS_OPTIONS = [
  { value: 'orchestrate', label: RUN_ORCHESTRATOR_CHOICE, icon: CONCEPT_ICONS.orchestrator },
  { value: 'workflow', label: RUN_WORKFLOW_CHOICE, icon: CONCEPT_ICONS.workflows },
  { value: 'agent', label: START_AGENT_CHOICE, icon: CONCEPT_ICONS.agents },
] as const satisfies readonly [RunsAsOption, ...ReadonlyArray<RunsAsOption>];
