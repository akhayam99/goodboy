import type { LucideIcon } from 'lucide-react';
import type { NewDrawerForm } from '../../store/slices/drawer/state';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import {
  AGENT_LINE,
  ASK_AGENT_CHOICE,
  AUTO_AGENT_LINE,
  DRAW_WIREFRAME_CHOICE,
  ORCHESTRATE_CHOICE,
  ORCHESTRATE_LINE,
  RUN_LINE,
  RUN_WORKFLOW_CHOICE,
  START_AUTO_CHOICE,
  WRITE_REPORT_CHOICE,
} from '../../shared/lib/startCopy';

type NewDrawerFormMeta = {
  readonly title: string;
  readonly icon: LucideIcon;
  readonly line: string | null;
  readonly isAutoOnly: boolean;
};

export const NEW_DRAWER_FORMS = {
  run: {
    title: RUN_WORKFLOW_CHOICE,
    icon: CONCEPT_ICONS.workflows,
    line: RUN_LINE,
    isAutoOnly: false,
  },
  orchestrate: {
    title: ORCHESTRATE_CHOICE,
    icon: CONCEPT_ICONS.orchestrator,
    line: ORCHESTRATE_LINE,
    isAutoOnly: false,
  },
  agent: {
    title: ASK_AGENT_CHOICE,
    icon: CONCEPT_ICONS.agents,
    line: AGENT_LINE,
    isAutoOnly: false,
  },
  auto: {
    title: START_AUTO_CHOICE,
    icon: CONCEPT_ICONS.auto,
    line: AUTO_AGENT_LINE,
    isAutoOnly: true,
  },
  report: {
    title: WRITE_REPORT_CHOICE,
    icon: CONCEPT_ICONS.report,
    line: null,
    isAutoOnly: false,
  },
  wireframe: {
    title: DRAW_WIREFRAME_CHOICE,
    icon: CONCEPT_ICONS.wireframe,
    line: null,
    isAutoOnly: false,
  },
} as const satisfies Readonly<Record<NewDrawerForm, NewDrawerFormMeta>>;
