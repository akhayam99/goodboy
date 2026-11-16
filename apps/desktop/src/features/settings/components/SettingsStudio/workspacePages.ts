import type { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import { PERMISSIONS_SECTION_ID } from '../../../permissions/openPermissionSettings';
import { REVIEW_REPLIES_SECTION_ID } from '../../../resolve/replySettingsCopy';
import { MODELS_PAGE_SECTION, isModelsPage } from '../../isModelsPage';

export type WorkspacePage =
  | 'projects'
  | 'profile'
  | 'general'
  | typeof MODELS_PAGE_SECTION
  | typeof PERMISSIONS_SECTION_ID
  | 'branches'
  | typeof REVIEW_REPLIES_SECTION_ID;

const TRACK_WITH_GIT_SECTION_ID = 'track-with-git';

const LEGACY_DEV_PROJECT_SECTION_ID = 'dev-project';

const FOLDER_OPTIONS_SECTION_ID = 'folder-options';

type WorkspacePageEntry = {
  readonly id: WorkspacePage;
  readonly label: string;
  readonly concept: keyof typeof CONCEPT_ICONS;
};

const ALL_WORKSPACE_PAGES = [
  {
    id: 'projects',
    label: NAMES.projects,
    concept: 'projectRepo',
  },
  {
    id: 'profile',
    label: 'About you',
    concept: 'profile',
  },
  {
    id: 'general',
    label: NAMES.runDefaults,
    concept: 'terminal',
  },
  {
    id: MODELS_PAGE_SECTION,
    label: NAMES.models,
    concept: 'providers',
  },
  {
    id: PERMISSIONS_SECTION_ID,
    label: NAMES.permissions,
    concept: 'approval',
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
] as const satisfies ReadonlyArray<WorkspacePageEntry>;

export const WORKSPACE_PAGES: ReadonlyArray<WorkspacePageEntry> = ALL_WORKSPACE_PAGES;

type SectionParams = {
  readonly section?: string;
};

export const isTrackWithGitSection = ({ section }: SectionParams): boolean =>
  section === TRACK_WITH_GIT_SECTION_ID || section === LEGACY_DEV_PROJECT_SECTION_ID;

export const isFolderOptionsSection = ({ section }: SectionParams): boolean =>
  section === FOLDER_OPTIONS_SECTION_ID;

const DEFAULT_WORKSPACE_PAGE: PlanPage = 'projects';

const SECTION_ALIASES: ReadonlyMap<string, WorkspacePage> = new Map<string, WorkspacePage>([
  [TRACK_WITH_GIT_SECTION_ID, 'projects'],
  [LEGACY_DEV_PROJECT_SECTION_ID, 'projects'],
  [FOLDER_OPTIONS_SECTION_ID, 'projects'],
  ['after-merge', 'branches'],
  ['security-findings', PERMISSIONS_SECTION_ID],
]);

export const workspacePageOf = ({ section }: SectionParams): WorkspacePage => {
  if (section === undefined) {
    return DEFAULT_WORKSPACE_PAGE;
  }
  if (isModelsPage({ section })) {
    return MODELS_PAGE_SECTION;
  }
  const page = WORKSPACE_PAGES.find((entry) => entry.id === section);
  return page?.id ?? SECTION_ALIASES.get(section) ?? DEFAULT_WORKSPACE_PAGE;
};

export const workspacePageEntry = ({ page }: { readonly page: WorkspacePage }) =>
  WORKSPACE_PAGES.find((entry) => entry.id === page) ?? ALL_WORKSPACE_PAGES[0];

export type PlanPage = Exclude<WorkspacePage, typeof MODELS_PAGE_SECTION>;

export const planPageOf = ({ section }: SectionParams): PlanPage => {
  const page = workspacePageOf({ section });
  return page === MODELS_PAGE_SECTION ? DEFAULT_WORKSPACE_PAGE : page;
};

export const PLAN_PAGES: ReadonlyArray<PlanPage> = ALL_WORKSPACE_PAGES.flatMap((entry) =>
  entry.id === MODELS_PAGE_SECTION ? [] : [entry.id],
);

export const planPageLabel = ({ page }: { readonly page: PlanPage }): string =>
  workspacePageEntry({ page }).label;
