import {
  GitPullRequest,
  LayoutList,
  Network,
  Plug,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react';
import { DEMO_GROUPS } from '../demoGroups';

type GroupId = keyof typeof DEMO_GROUPS;

const GROUP_ICON = {
  setup: Plug,
  agent: SquareTerminal,
  orchestrate: Network,
  find: LayoutList,
  review: GitPullRequest,
} as const satisfies Readonly<Record<GroupId, LucideIcon>>;

export const PHONE_GROUPS = Object.values(DEMO_GROUPS).map((group) => ({
  title: group.title,
  line: group.line,
  icon: GROUP_ICON[group.id],
}));
