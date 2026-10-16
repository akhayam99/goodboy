import type { LucideIcon } from 'lucide-react';
import type { NewDrawerForm } from '../../store/slices/drawer/state';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import {
  AGENT_LINE,
  AUTO_AGENT_LINE,
  ORCHESTRATE_LINE,
  RUN_LINE,
} from '../../shared/lib/startCopy';

type NewDrawerFormMeta = {
  readonly title: string;
  readonly icon: LucideIcon;
  readonly line: string;
  readonly isAutoOnly: boolean;
};

export const NEW_DRAWER_FORMS = {
  run: {
    title: 'Run a workflow',
    icon: CONCEPT_ICONS.workflows,
    line: RUN_LINE,
    isAutoOnly: false,
  },
  orchestrate: {
    title: 'Orchestrate',
    icon: CONCEPT_ICONS.orchestrator,
    line: ORCHESTRATE_LINE,
    isAutoOnly: false,
  },
  agent: { title: 'Start agent', icon: CONCEPT_ICONS.agents, line: AGENT_LINE, isAutoOnly: false },
  auto: { title: 'Start Auto', icon: CONCEPT_ICONS.auto, line: AUTO_AGENT_LINE, isAutoOnly: true },
  report: {
    title: 'Report',
    icon: CONCEPT_ICONS.report,
    line: 'A report written from this session.',
    isAutoOnly: false,
  },
  wireframe: {
    title: 'Wireframe',
    icon: CONCEPT_ICONS.wireframe,
    line: 'A wireframe drawn from this session.',
    isAutoOnly: false,
  },
} as const satisfies Readonly<Record<NewDrawerForm, NewDrawerFormMeta>>;
