import type { ArtifactId } from '@goodboy/types';
import { DRAFT_RUN_WORDS } from './DRAFT_RUN_WORDS';
import { PENDING_DRAFT_SAVES } from './PENDING_DRAFT_SAVES';
import { draftSavesOk } from './draftSavesOk';
import { heldDraftStore } from './heldDraftStore';

type BlockedWords = Readonly<{ title: string; message: string }>;

type Params = Readonly<{
  artifactId: ArtifactId | null;
  run: () => void;
  onBlocked?: (words: BlockedWords) => void;
}>;

export const afterDraftSaves = ({ artifactId, run, onBlocked }: Params): void => {
  const isHeld = artifactId !== null && heldDraftStore.hasFor({ artifactId });
  if (PENDING_DRAFT_SAVES.size === 0 && !isHeld) {
    run();
    return;
  }
  void draftSavesOk({ artifactId }).then((isOk) => {
    if (isOk) {
      run();
      return;
    }
    onBlocked?.({ title: DRAFT_RUN_WORDS.title, message: DRAFT_RUN_WORDS.held });
  });
};
