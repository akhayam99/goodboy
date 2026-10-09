import type { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { NAMES } from '../../../../shared/names';
import { PERMISSIONS_SECTION_ID } from '../../../permissions/openPermissionSettings';
import { REVIEW_REPLIES_SECTION_ID } from '../../../resolve/replySettingsCopy';

export type WorkspacePage =
  | 'projects'
  | 'profile'
  | 'general'
  | 'after-merge'
  | typeof REVIEW_REPLIES_SECTION_ID
  | typeof PERMISSIONS_SECTION_ID
  | 'skills';

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
    hint: 'What agents should know about you.',
  },
  {
    id: 'general',
    label: 'New sessions',
    concept: 'terminal',
    hint: 'Defaults for every new session.',
  },
  {
    id: 'after-merge',
    label: 'After merge',
    concept: 'merge',
    hint: 'What happens once a pull request lands.',
  },
  {
    id: REVIEW_REPLIES_SECTION_ID,
    label: NAMES.repliesAndCommits,
    concept: 'resolve',
    hint: 'How replies are written and how fixes are committed.',
  },
  {
    id: PERMISSIONS_SECTION_ID,
    label: 'Permissions',
    concept: 'approval',
    hint: 'How much agents may do without asking.',
  },
  {
    id: 'skills',
    label: 'Skills',
    concept: 'skills',
    hint: 'Instructions agents can load on demand.',
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

const WORKFLOW_RULES_PLAN_PAGE = 'workflow-rules';

export type PlanPage = WorkspacePage | typeof WORKFLOW_RULES_PLAN_PAGE;

export const PLAN_PAGES: ReadonlyArray<PlanPage> = [
  ...WORKSPACE_PAGES.map((entry) => entry.id),
  WORKFLOW_RULES_PLAN_PAGE,
];

export const planPageLabel = ({ page }: { readonly page: PlanPage }): string =>
  page === WORKFLOW_RULES_PLAN_PAGE ? NAMES.runDefaults : workspacePageEntry({ page }).label;
