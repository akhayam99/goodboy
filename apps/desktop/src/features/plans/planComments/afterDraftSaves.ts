import { PENDING_DRAFT_SAVES } from './PENDING_DRAFT_SAVES';

type Params = Readonly<{ run: () => void }>;

export const afterDraftSaves = ({ run }: Params): void => {
  if (PENDING_DRAFT_SAVES.size === 0) {
    run();
    return;
  }
  void Promise.allSettled([...PENDING_DRAFT_SAVES]).then(() => {
    window.setTimeout(run, 0);
  });
};
