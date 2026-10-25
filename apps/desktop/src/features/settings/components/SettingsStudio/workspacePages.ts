import type { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { NAMES } from '../../../../shared/utils/names';
import { PERMISSIONS_SECTION_ID } from '../../../permissions/openPermissionSettings';
import { REVIEW_REPLIES_SECTION_ID } from '../../../resolve/replySettingsCopy';

export type WorkspacePage =
  | 'projects'
  | 'profile'
  | 'general'
  | 'branches'
  | typeof REVIEW_REPLIES_SECTION_ID
  | typeof PERMISSIONS_SECTION_ID
  | 'skills';

const TRACK_WITH_GIT_SECTION_ID = 'track-with-git';

const LEGACY_DEV_PROJECT_SECTION_ID = 'dev-project';

type WorkspacePageEntry = {
  readonly id: WorkspacePage;
  readonly label: string;
  readonly concept: keyof typeof CONCEPT_ICONS;
};

const ALL_WORKSPACE_PAGES = [
  {
    id: 'projects',
    label: NAMES.folders,
    concept: 'projectRepo',
  },
  {
    id: 'profile',
    label: 'About you',
    concept: 'profile',
  },
  {
    id: 'general',
    label: 'New sessions',
    concept: 'terminal',
  },
  {
    id: 'branches',
    label: NAMES.branches,
    concept: 'branch',
  },
  {
    id: REVIEW_REPLIES_SECTION_ID,
    label: NAMES.repliesAndCommits,
    concept: 'resolve',
  },
  {
    id: PERMISSIONS_SECTION_ID,
    label: 'Permissions',
    concept: 'approval',
  },
  {
    id: 'skills',
    label: 'Skills',
    concept: 'skills',
  },
] as const satisfies ReadonlyArray<WorkspacePageEntry>;

export const WORKSPACE_PAGES: ReadonlyArray<WorkspacePageEntry> = ALL_WORKSPACE_PAGES.filter(
  (page) => page.id !== 'skills' || WORKSPACE_FEATURES.skills,
);

type SectionParams = {
  readonly section?: string;
};

export const isTrackWithGitSection = ({ section }: SectionParams): boolean =>
  section === TRACK_WITH_GIT_SECTION_ID || section === LEGACY_DEV_PROJECT_SECTION_ID;

const DEFAULT_WORKSPACE_PAGE: WorkspacePage = 'projects';

const SECTION_ALIASES: ReadonlyMap<string, WorkspacePage> = new Map<string, WorkspacePage>([
  [TRACK_WITH_GIT_SECTION_ID, 'projects'],
  [LEGACY_DEV_PROJECT_SECTION_ID, 'projects'],
  ['after-merge', 'branches'],
]);

export const workspacePageOf = ({ section }: { readonly section?: string }): WorkspacePage => {
  if (section === undefined) {
    return DEFAULT_WORKSPACE_PAGE;
  }
  const page = WORKSPACE_PAGES.find((entry) => entry.id === section);
  return page?.id ?? SECTION_ALIASES.get(section) ?? DEFAULT_WORKSPACE_PAGE;
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
