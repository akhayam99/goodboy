import type { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { PERMISSIONS_SECTION_ID } from '../../../permissions/openPermissionSettings';
import { REVIEW_REPLIES_SECTION_ID } from '../../../resolve/replySettingsCopy';

export type WorkspacePage =
  | 'projects'
  | 'profile'
  | 'general'
  | 'after-merge'
  | 'workflow-rules'
  | typeof REVIEW_REPLIES_SECTION_ID
  | typeof PERMISSIONS_SECTION_ID
  | 'skills'
  | 'danger';

export const DEV_PROJECT_SECTION_ID = 'dev-project';

type WorkspacePageEntry = {
  readonly id: WorkspacePage;
  readonly label: string;
  readonly concept: keyof typeof CONCEPT_ICONS;
  readonly hint: string;
};

const ALL_WORKSPACE_PAGES = [
  {
    id: 'projects',
    label: 'Projects',
    concept: 'projectRepo',
    hint: 'The repositories and folders agents work in.',
  },
  {
    id: 'profile',
    label: 'About you',
    concept: 'profile',
    hint: 'What agents should know about you in this workspace.',
  },
  {
    id: 'general',
    label: 'New sessions',
    concept: 'terminal',
    hint: 'What every new session in this workspace starts with.',
  },
  {
    id: 'workflow-rules',
    label: 'Workflow rules',
    concept: 'workflows',
    hint: 'Defaults every new workflow run starts with.',
  },
  {
    id: 'after-merge',
    label: 'After merge',
    concept: 'merge',
    hint: 'What happens once a pull request lands.',
  },
  {
    id: REVIEW_REPLIES_SECTION_ID,
    label: 'Review replies',
    concept: 'resolve',
    hint: 'How Goodboy answers review comments for you.',
  },
  {
    id: PERMISSIONS_SECTION_ID,
    label: 'Permissions',
    concept: 'approval',
    hint: 'What agents may do without asking you.',
  },
  {
    id: 'skills',
    label: 'Skills',
    concept: 'skills',
    hint: 'Instructions agents load when a task needs them.',
  },
  {
    id: 'danger',
    label: 'Disconnect',
    concept: 'disconnect',
    hint: 'Take this workspace off this Mac.',
  },
] as const satisfies ReadonlyArray<WorkspacePageEntry>;

export const WORKSPACE_PAGES: ReadonlyArray<WorkspacePageEntry> = ALL_WORKSPACE_PAGES.filter(
  (page) => page.id !== 'skills' || WORKSPACE_FEATURES.skills,
);

const DEFAULT_WORKSPACE_PAGE: WorkspacePage = 'projects';

const SECTION_ALIASES: Readonly<Record<string, WorkspacePage>> = {
  [DEV_PROJECT_SECTION_ID]: 'projects',
};

export const workspacePageOf = ({ section }: { readonly section?: string }): WorkspacePage => {
  if (section === undefined) {
    return DEFAULT_WORKSPACE_PAGE;
  }
  const page = WORKSPACE_PAGES.find((entry) => entry.id === section);
  return page?.id ?? SECTION_ALIASES[section] ?? DEFAULT_WORKSPACE_PAGE;
};

export const workspacePageEntry = ({ page }: { readonly page: WorkspacePage }) =>
  WORKSPACE_PAGES.find((entry) => entry.id === page) ?? ALL_WORKSPACE_PAGES[0];
