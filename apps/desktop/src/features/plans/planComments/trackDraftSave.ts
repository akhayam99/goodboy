import { PENDING_DRAFT_SAVES } from './PENDING_DRAFT_SAVES';
import type { HeldDraft } from './heldDraft';
import { heldDraftStore } from './heldDraftStore';

type Params = Readonly<{ save: Promise<unknown>; draft: HeldDraft }>;

export const trackDraftSave = ({ save, draft }: Params): void => {
  PENDING_DRAFT_SAVES.add(save);
  void save.then(
    () => {
      PENDING_DRAFT_SAVES.delete(save);
      heldDraftStore.release({ draft });
    },
    () => {
      PENDING_DRAFT_SAVES.delete(save);
      heldDraftStore.hold({ draft });
    },
  );
};
