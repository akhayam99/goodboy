import type { LucideIcon } from 'lucide-react';
import type { SearchKind } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../shared/components/conceptIcons';

type KindMeta = {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly tone: Tone;
};

export const SEARCH_KIND_META: Readonly<Record<SearchKind, KindMeta>> = {
  session: { label: 'Session', icon: CONCEPT_ICONS.sessions, tone: CONCEPT_TONE.sessions },
  message: { label: 'Message', icon: CONCEPT_ICONS.message, tone: CONCEPT_TONE.message },
  agent: { label: 'Agent', icon: CONCEPT_ICONS.agents, tone: CONCEPT_TONE.agents },
  plan: { label: 'Plan', icon: CONCEPT_ICONS.plan, tone: CONCEPT_TONE.plan },
  report: { label: 'Report', icon: CONCEPT_ICONS.report, tone: CONCEPT_TONE.report },
  wireframe: { label: 'Wireframe', icon: CONCEPT_ICONS.wireframe, tone: CONCEPT_TONE.wireframe },
  decision: { label: 'Decision', icon: CONCEPT_ICONS.decisions, tone: CONCEPT_TONE.decisions },
  question: { label: 'Question', icon: CONCEPT_ICONS.questions, tone: CONCEPT_TONE.questions },
  issue: { label: 'Issue', icon: CONCEPT_ICONS.issues, tone: CONCEPT_TONE.issues },
  pr: { label: 'Pull request', icon: CONCEPT_ICONS.pr, tone: CONCEPT_TONE.pr },
  branch: { label: 'Branch', icon: CONCEPT_ICONS.branch, tone: CONCEPT_TONE.branch },
};
