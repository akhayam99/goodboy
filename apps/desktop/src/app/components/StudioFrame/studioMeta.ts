import type { FramePage, Tone } from '@goodboy/ui';
import { Smartphone, type LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/names';
import type { StudioKind } from '../../../store';

export type StudioSkeletonShape = 'rows' | 'prose' | 'room' | 'terminal' | 'cards';

export type StudioSkeletonSpec = {
  readonly shape: StudioSkeletonShape;
  readonly hasRail: boolean;
};

type StudioCloseHome = 'none' | 'header' | 'band';

type StudioMeta = {
  readonly icon: LucideIcon;
  readonly tone?: Tone;
  readonly title: string;
  readonly closeLabel: string;
  readonly close: StudioCloseHome;
  readonly tier: 'column' | 'full';
  readonly page: FramePage | null;
  readonly skeleton: StudioSkeletonSpec;
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
    skeleton: { shape: 'rows', hasRail: true },
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
    skeleton: { shape: 'prose', hasRail: true },
    railWidth: 'standard',
  },
  companion: {
    icon: Smartphone,
    title: 'Pair device',
    closeLabel: 'Close pairing',
    close: 'band',
    tier: 'full',
    page: null,
    skeleton: { shape: 'cards', hasRail: false },
  },
  addWorkspace: {
    icon: CONCEPT_ICONS.workspace,
    tone: CONCEPT_TONE.workspace,
    title: 'Add workspace',
    closeLabel: 'Close add workspace',
    close: 'band',
    tier: 'column',
    page: null,
    skeleton: { shape: 'rows', hasRail: false },
  },
  workflow: {
    icon: CONCEPT_ICONS.workflows,
    tone: CONCEPT_TONE.workflows,
    title: 'Workflows',
    closeLabel: 'Close workflows',
    close: 'none',
    tier: 'column',
    page: 'workflows',
    skeleton: { shape: 'rows', hasRail: false },
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
    skeleton: { shape: 'rows', hasRail: false },
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
    skeleton: { shape: 'cards', hasRail: false },
  },
  changelog: {
    icon: CONCEPT_ICONS.changelog,
    tone: CONCEPT_TONE.changelog,
    title: NAMES.whatsNew,
    closeLabel: `Close ${NAMES.whatsNew.toLowerCase()}`,
    close: 'band',
    tier: 'column',
    page: 'whatsNew',
    skeleton: { shape: 'prose', hasRail: true },
  },
  notifications: {
    icon: CONCEPT_ICONS.notifications,
    tone: CONCEPT_TONE.notifications,
    title: 'Notifications',
    closeLabel: 'Close notifications',
    close: 'header',
    tier: 'column',
    page: 'notifications',
    skeleton: { shape: 'rows', hasRail: true },
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
    skeleton: { shape: 'room', hasRail: true },
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
    skeleton: { shape: 'terminal', hasRail: true },
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
    skeleton: { shape: 'rows', hasRail: false },
  },
} as const satisfies Record<StudioKind, StudioMeta>;
