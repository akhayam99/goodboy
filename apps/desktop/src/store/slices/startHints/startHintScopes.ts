import type { MountId } from '@goodboy/types';

type CheckParams = {
  readonly mountId: MountId;
  readonly url: string;
};

type MountParams = {
  readonly mountId: MountId;
};

export const START_HINT_SCOPES = {
  fixComments: 'fix-comments',
  checkFix: ({ mountId, url }: CheckParams): string => `check:${mountId}:${url}`,
  checkAnalyze: ({ mountId, url }: CheckParams): string => `analyze:${mountId}:${url}`,
  pushFix: ({ mountId }: MountParams): string => `push-fix:${mountId}`,
  rebase: ({ mountId }: MountParams): string => `rebase:${mountId}`,
} as const;
