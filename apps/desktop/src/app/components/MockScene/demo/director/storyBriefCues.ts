import type { WorkspaceId } from '@goodboy/types';
import type { DemoCue } from './directorTypes';
import { TEXT_SENTENCE_MS } from './textCuesEndMs';

const TITLE_AT_MS = 1300;
const BODY_AT_MS = 1900;
const BODY_SPAN_MS = 1200;
const READY_AT_MS = 3400;

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly brief: string;
  readonly onDone: DemoCue['apply'];
};

type TextParams = {
  readonly text: string;
};

const chunksOf = ({ text }: TextParams): ReadonlyArray<string> =>
  text.split(/(?<=\n\n|\. )/).filter((chunk) => chunk !== '');

export const storyBriefCues = ({ workspaceId, brief, onDone }: Params): ReadonlyArray<DemoCue> => {
  const chunks = chunksOf({ text: brief });
  const bodyCount = chunks.length - 1;
  const stepMs =
    bodyCount <= 1 ? 0 : Math.min(TEXT_SENTENCE_MS, Math.floor(BODY_SPAN_MS / (bodyCount - 1)));
  const writes = chunks.map((_chunk, index): DemoCue => ({
    atMs: index === 0 ? TITLE_AT_MS : BODY_AT_MS + (index - 1) * stepMs,
    apply: ({ store }) => {
      store.getState().patchSessionDraft({
        workspaceId,
        patch: { workflowGoal: chunks.slice(0, index + 1).join('') },
      });
    },
  }));
  return [...writes, { atMs: READY_AT_MS, apply: onDone }];
};
