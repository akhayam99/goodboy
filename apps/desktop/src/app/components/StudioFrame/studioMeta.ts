import type { Tone } from '@goodboy/ui';
import { BookOpen, Smartphone, type LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import type { StudioKind } from '../../../store';

export type StudioSkeletonLayout = 'list' | 'rail' | 'grid';

type StudioMeta = {
  readonly icon: LucideIcon;
  readonly tone?: Tone;
  readonly title: string;
  readonly closeLabel: string;
  readonly skeleton: StudioSkeletonLayout;
};

export const STUDIO_META = {
  settings: {
    icon: CONCEPT_ICONS.settings,
    tone: CONCEPT_TONE.settings,
    title: 'Settings',
    closeLabel: 'close settings',
    skeleton: 'rail',
  },
  guide: {
    icon: BookOpen,
    title: 'Getting started',
    closeLabel: 'close getting started',
    skeleton: 'grid',
  },
  report: {
    icon: CONCEPT_ICONS.reportIssue,
    tone: CONCEPT_TONE.reportIssue,
    title: 'Report an issue',
    closeLabel: 'close report an issue',
    skeleton: 'list',
  },
  companion: {
    icon: Smartphone,
    title: 'Pair device',
    closeLabel: 'Close pairing',
    skeleton: 'grid',
  },
  addWorkspace: {
    icon: CONCEPT_ICONS.workspace,
    tone: CONCEPT_TONE.workspace,
    title: 'Add workspace',
    closeLabel: 'close add workspace',
    skeleton: 'list',
  },
  workflow: {
    icon: CONCEPT_ICONS.workflows,
    tone: CONCEPT_TONE.workflows,
    title: 'Workflows',
    closeLabel: 'close workflows',
    skeleton: 'grid',
  },
  inbox: {
    icon: CONCEPT_ICONS.inbox,
    tone: CONCEPT_TONE.inbox,
    title: 'Inbox',
    closeLabel: 'close inbox',
    skeleton: 'list',
  },
  impact: {
    icon: CONCEPT_ICONS.impact,
    tone: CONCEPT_TONE.impact,
    title: 'Impact',
    closeLabel: 'close impact',
    skeleton: 'rail',
  },
  changelog: {
    icon: CONCEPT_ICONS.changelog,
    tone: CONCEPT_TONE.changelog,
    title: 'Changelog',
    closeLabel: 'close changelog',
    skeleton: 'grid',
  },
  notifications: {
    icon: CONCEPT_ICONS.notifications,
    tone: CONCEPT_TONE.notifications,
    title: 'Notifications',
    closeLabel: 'close notifications',
    skeleton: 'list',
  },
} as const satisfies Record<StudioKind, StudioMeta>;
