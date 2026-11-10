import type { FramePage, Tone } from '@goodboy/ui';
import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/utils/names';
import type { StudioKind } from '../../../store';

export type StudioSkeletonShape = 'rows' | 'prose' | 'room' | 'terminal' | 'cards';

export type StudioSkeletonSpec = {
  readonly shape: StudioSkeletonShape;
  readonly hasRail: boolean;
};

type StudioCloseHome = 'none' | 'back';

type StudioMeta = {
  readonly icon: LucideIcon;
  readonly tone?: Tone;
  readonly title: string;
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
    close: 'back',
    tier: 'column',
    page: 'settings',
    skeleton: { shape: 'rows', hasRail: true },
    railWidth: 'narrow',
  },
  guide: {
    icon: CONCEPT_ICONS.guide,
    tone: CONCEPT_TONE.guide,
    title: NAMES.guide,
    close: 'back',
    tier: 'column',
    page: 'guide',
    skeleton: { shape: 'prose', hasRail: true },
    railWidth: 'standard',
  },
  addWorkspace: {
    icon: CONCEPT_ICONS.workspace,
    tone: CONCEPT_TONE.workspace,
    title: NAMES.newWorkspace,
    close: 'back',
    tier: 'column',
    page: null,
    skeleton: { shape: 'rows', hasRail: false },
  },
  workflow: {
    icon: CONCEPT_ICONS.workflows,
    tone: CONCEPT_TONE.workflows,
    title: 'Workflows',
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
    close: 'none',
    tier: 'column',
    page: 'impact',
    skeleton: { shape: 'cards', hasRail: false },
  },
  changelog: {
    icon: CONCEPT_ICONS.changelog,
    tone: CONCEPT_TONE.changelog,
    title: NAMES.whatsNew,
    close: 'back',
    tier: 'column',
    page: 'whatsNew',
    skeleton: { shape: 'prose', hasRail: true },
  },
  notifications: {
    icon: CONCEPT_ICONS.notifications,
    tone: CONCEPT_TONE.notifications,
    title: 'Notifications',
    close: 'none',
    tier: 'column',
    page: 'notifications',
    skeleton: { shape: 'rows', hasRail: true },
    railWidth: 'standard',
  },
  chat: {
    icon: CONCEPT_ICONS.chat,
    tone: CONCEPT_TONE.chat,
    title: 'Chat',
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
    close: 'none',
    tier: 'full',
    page: 'terminal',
    skeleton: { shape: 'terminal', hasRail: true },
    railWidth: 'standard',
  },
  browser: {
    icon: CONCEPT_ICONS.browser,
    tone: CONCEPT_TONE.browser,
    title: 'Browser',
    close: 'none',
    tier: 'full',
    page: 'browser',
    skeleton: { shape: 'rows', hasRail: true },
    railWidth: 'standard',
  },
  monitoring: {
    icon: CONCEPT_ICONS.monitoring,
    tone: CONCEPT_TONE.monitoring,
    title: 'Monitoring',
    close: 'none',
    tier: 'column',
    page: 'monitoring',
    skeleton: { shape: 'rows', hasRail: false },
  },
} as const satisfies Record<StudioKind, StudioMeta>;
