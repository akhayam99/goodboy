import type { Tone } from '@goodboy/ui';
import { Smartphone, type LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import type { StudioKind } from '../../../store';

export type StudioSkeletonLayout = 'list' | 'rail' | 'grid';

type StudioMeta = {
  readonly icon: LucideIcon;
  readonly tone?: Tone;
  readonly title: string;
  readonly closeLabel: string;
  readonly skeleton: StudioSkeletonLayout;
  readonly railWidth?: 'narrow' | 'standard';
};

export const STUDIO_META = {
  settings: {
    icon: CONCEPT_ICONS.settings,
    tone: CONCEPT_TONE.settings,
    title: 'Settings',
    closeLabel: 'Close settings',
    skeleton: 'rail',
    railWidth: 'narrow',
  },
  guide: {
    icon: CONCEPT_ICONS.guide,
    tone: CONCEPT_TONE.guide,
    title: 'Guide',
    closeLabel: 'Close guide',
    skeleton: 'rail',
    railWidth: 'standard',
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
    closeLabel: 'Close add workspace',
    skeleton: 'list',
  },
  workflow: {
    icon: CONCEPT_ICONS.workflows,
    tone: CONCEPT_TONE.workflows,
    title: 'Workflows',
    closeLabel: 'Close workflows',
    skeleton: 'grid',
  },
  inbox: {
    icon: CONCEPT_ICONS.inbox,
    tone: CONCEPT_TONE.inbox,
    title: 'Inbox',
    closeLabel: 'Close inbox',
    skeleton: 'list',
  },
  impact: {
    icon: CONCEPT_ICONS.impact,
    tone: CONCEPT_TONE.impact,
    title: 'Impact',
    closeLabel: 'Close impact',
    skeleton: 'list',
  },
  changelog: {
    icon: CONCEPT_ICONS.changelog,
    tone: CONCEPT_TONE.changelog,
    title: 'Changelog',
    closeLabel: 'Close changelog',
    skeleton: 'grid',
  },
  notifications: {
    icon: CONCEPT_ICONS.notifications,
    tone: CONCEPT_TONE.notifications,
    title: 'Notifications',
    closeLabel: 'Close notifications',
    skeleton: 'list',
  },
  chat: {
    icon: CONCEPT_ICONS.chat,
    tone: CONCEPT_TONE.chat,
    title: 'Chat',
    closeLabel: 'Close chat',
    skeleton: 'rail',
    railWidth: 'narrow',
  },
} as const satisfies Record<StudioKind, StudioMeta>;
