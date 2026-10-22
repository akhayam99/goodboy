import { brandId, type MountId, type ProjectId } from '@goodboy/types';

export type NextListMount = Readonly<{
  page: string;
  mountId: MountId;
  projectId: ProjectId;
  branch: string;
  worktreePath: string;
  request: string | null;
}>;

const PROJECT_ID = brandId<ProjectId>({ value: 'mock-next-project-harbor-portal' });

type PageParams = {
  readonly page: string;
  readonly request?: string | null;
};

const mountOf = ({ page, request = null }: PageParams): NextListMount => ({
  page,
  mountId: brandId<MountId>({ value: `mock-next-mount-${page}` }),
  projectId: PROJECT_ID,
  branch: `hl/feat-center-${page}-page`,
  worktreePath: `/mock/harbor-portal/${page}`,
  request,
});

export const NEXT_LIST_MOUNTS = {
  home: mountOf({ page: 'home', request: '#9995' }),
  billing: mountOf({ page: 'billing', request: '#9993' }),
  search: mountOf({ page: 'search' }),
  settings: mountOf({ page: 'settings' }),
  profile: mountOf({ page: 'profile' }),
  pricing: mountOf({ page: 'pricing' }),
  about: mountOf({ page: 'about', request: '#9990' }),
  faq: mountOf({ page: 'faq' }),
  careers: mountOf({ page: 'careers' }),
  contact: mountOf({ page: 'contact' }),
} as const satisfies Readonly<Record<string, NextListMount>>;
