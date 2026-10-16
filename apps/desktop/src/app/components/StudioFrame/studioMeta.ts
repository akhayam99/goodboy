import type { FramePage, Tone } from '@goodboy/ui';
import { Smartphone, type LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/names';
import type { StudioKind } from '../../../store';

export type StudioSkeletonLayout = 'list' | 'rail' | 'grid';

type StudioCloseHome = 'none' | 'header' | 'band';

type StudioMeta = {
  readonly icon: LucideIcon;
  readonly tone?: Tone;
  readonly title: string;
  readonly closeLabel: string;
  readonly close: StudioCloseHome;
  readonly tier: 'column' | 'full';
  readonly page: FramePage | null;
  readonly skeleton: StudioSkeletonLayout;
  readonly railWidth?: 'narrow' | 'standard';
  readonly canHostDrawer?: boolean;
};

export const STUDIO_META = {
  settings: {
    icon: CONCEPT_ICONS.settings,
    tone: CONCEPT_TONE.settings,
    title: 'Settings',
    closeLabel: 'Close settings',
    close: 'band',
    tier: 'column',
    page: 'settings',
    skeleton: 'rail',
    railWidth: 'narrow',
  },
  guide: {
    icon: CONCEPT_ICONS.guide,
    tone: CONCEPT_TONE.guide,
    title: 'Guide',
    closeLabel: 'Close guide',
    close: 'header',
    tier: 'column',
    page: 'guide',
    skeleton: 'rail',
    railWidth: 'standard',
  },
  companion: {
    icon: Smartphone,
    title: 'Pair device',
    closeLabel: 'Close pairing',
    close: 'band',
    tier: 'full',
    page: null,
    skeleton: 'grid',
  },
  addWorkspace: {
    icon: CONCEPT_ICONS.workspace,
    tone: CONCEPT_TONE.workspace,
    title: 'Add workspace',
    closeLabel: 'Close add workspace',
    close: 'band',
    tier: 'column',
    page: null,
    skeleton: 'list',
  },
  workflow: {
    icon: CONCEPT_ICONS.workflows,
    tone: CONCEPT_TONE.workflows,
    title: 'Workflows',
    closeLabel: 'Close workflows',
    close: 'none',
    tier: 'column',
    page: 'workflows',
    skeleton: 'grid',
    canHostDrawer: true,
  },
  inbox: {
    icon: CONCEPT_ICONS.inbox,
    tone: CONCEPT_TONE.inbox,
    title: NAMES.tasks,
    closeLabel: 'Close tasks',
    close: 'none',
    tier: 'column',
    page: 'inbox',
    skeleton: 'rail',
    railWidth: 'standard',
    canHostDrawer: true,
  },
  impact: {
    icon: CONCEPT_ICONS.impact,
    tone: CONCEPT_TONE.impact,
    title: 'Impact',
    closeLabel: 'Close impact',
    close: 'band',
    tier: 'column',
    page: 'impact',
    skeleton: 'list',
  },
  changelog: {
    icon: CONCEPT_ICONS.changelog,
    tone: CONCEPT_TONE.changelog,
    title: NAMES.whatsNew,
    closeLabel: `Close ${NAMES.whatsNew.toLowerCase()}`,
    close: 'band',
    tier: 'column',
    page: 'whatsNew',
    skeleton: 'grid',
  },
  notifications: {
    icon: CONCEPT_ICONS.notifications,
    tone: CONCEPT_TONE.notifications,
    title: 'Notifications',
    closeLabel: 'Close notifications',
    close: 'header',
    tier: 'column',
    page: 'notifications',
    skeleton: 'rail',
    railWidth: 'standard',
  },
  chat: {
    icon: CONCEPT_ICONS.chat,
    tone: CONCEPT_TONE.chat,
    title: 'Chat',
    closeLabel: 'Close chat',
    close: 'none',
    tier: 'column',
    page: 'chat',
    skeleton: 'rail',
    railWidth: 'standard',
    canHostDrawer: true,
  },
  terminal: {
    icon: CONCEPT_ICONS.terminal,
    tone: CONCEPT_TONE.terminal,
    title: 'Terminal',
    closeLabel: 'Close terminal',
    close: 'none',
    tier: 'full',
    page: 'terminal',
    skeleton: 'rail',
    railWidth: 'standard',
  },
  monitoring: {
    icon: CONCEPT_ICONS.monitoring,
    tone: CONCEPT_TONE.monitoring,
    title: 'Monitoring',
    closeLabel: 'Close monitoring',
    close: 'header',
    tier: 'column',
    page: 'monitoring',
    skeleton: 'list',
  },
} as const satisfies Record<StudioKind, StudioMeta>;
