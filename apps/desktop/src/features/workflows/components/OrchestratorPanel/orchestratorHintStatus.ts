import type { OrchestratorHint } from '@goodboy/types';

export type OrchestratorHintStatus = 'queued' | 'reading' | 'read';

type Params = {
  readonly hint: OrchestratorHint;
  readonly readingHintIds: ReadonlyArray<string>;
};

export const orchestratorHintStatus = ({
  hint,
  readingHintIds,
}: Params): OrchestratorHintStatus => {
  if (hint.consumedAt != null) {
    return 'read';
  }
  return readingHintIds.includes(hint.id) ? 'reading' : 'queued';
};
