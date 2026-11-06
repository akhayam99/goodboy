import { PENDING_DRAFT_SAVES } from './PENDING_DRAFT_SAVES';
import { draftSavesOk } from './draftSavesOk';

type Params = Readonly<{ run: () => void }>;

export const afterDraftSaves = ({ run }: Params): void => {
  if (PENDING_DRAFT_SAVES.size === 0) {
    run();
    return;
  }
  void draftSavesOk().then((isOk) => {
    if (isOk) {
      run();
    }
  });
};
