import { PENDING_DRAFT_SAVES } from './PENDING_DRAFT_SAVES';

type Params = Readonly<{ save: Promise<unknown> }>;

export const trackDraftSave = ({ save }: Params): void => {
  PENDING_DRAFT_SAVES.add(save);
  void save.then(
    () => PENDING_DRAFT_SAVES.delete(save),
    () => PENDING_DRAFT_SAVES.delete(save),
  );
};
