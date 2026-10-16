import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import {
  ASK_AGENT_CHOICE,
  ORCHESTRATE_CHOICE,
  RUN_WORKFLOW_CHOICE,
} from '../../../../shared/lib/startCopy';

export type RunsAs = 'workflow' | 'orchestrate' | 'agent';

type RunsAsOption = {
  readonly value: RunsAs;
  readonly label: string;
  readonly icon: LucideIcon;
};

export const RUNS_AS_OPTIONS = [
  { value: 'orchestrate', label: ORCHESTRATE_CHOICE, icon: CONCEPT_ICONS.orchestrator },
  { value: 'workflow', label: RUN_WORKFLOW_CHOICE, icon: CONCEPT_ICONS.workflows },
  { value: 'agent', label: ASK_AGENT_CHOICE, icon: CONCEPT_ICONS.agents },
] as const satisfies readonly [RunsAsOption, ...ReadonlyArray<RunsAsOption>];
