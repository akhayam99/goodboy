import {
  HelpCircle,
  Plug,
  Settings,
  Wallet,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export const SECTION_ICONS = {
  budget: Wallet,
  providers: Plug,
  workflows: Workflow,
  settings: Settings,
  guide: HelpCircle,
  skills: Wrench,
} satisfies Record<string, LucideIcon>;

export type SectionIconId = keyof typeof SECTION_ICONS;
