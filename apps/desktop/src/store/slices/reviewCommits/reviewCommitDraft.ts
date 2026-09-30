import { getSetting, setSetting } from '@goodboy/db';
import type { MountId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { reviewCommitDraftKey } from './state';
import type { GetFn, SetFn } from './types';

const remember = ({
  set,
  mountId,
  signature,
}: {
  readonly set: SetFn;
  readonly mountId: MountId;
  readonly signature: string;
}): void => {
  set((state) => ({
    reviewCommitDrafts: { ...state.reviewCommitDrafts, [mountId]: signature },
  }));
};

export const loadReviewCommitDraft = (set: SetFn, _get: GetFn) => {
  return async ({ mountId }: { readonly mountId: MountId }): Promise<void> => {
    const stored = await getSetting(tauriDatabase, reviewCommitDraftKey({ mountId })).catch(
      () => null,
    );
    if (typeof stored !== 'string' || stored === '') {
      return;
    }
    remember({ set, mountId, signature: stored });
  };
};

export const markReviewCommitDraft = (set: SetFn, _get: GetFn) => {
  return async ({
    mountId,
    signature,
  }: {
    readonly mountId: MountId;
    readonly signature: string;
  }): Promise<void> => {
    remember({ set, mountId, signature });
    await setSetting(tauriDatabase, reviewCommitDraftKey({ mountId }), signature).catch(
      () => undefined,
    );
  };
};
