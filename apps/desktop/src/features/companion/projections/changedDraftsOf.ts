import type { ProjectionDraft } from './projectionFieldsOf';

type Params = {
  readonly drafts: ReadonlyArray<ProjectionDraft>;
  readonly sent: ReadonlyMap<string, string>;
};

export type Changes = Readonly<{
  changed: ReadonlyArray<ProjectionDraft>;
  removed: ReadonlyArray<string>;
}>;

export const changedDraftsOf = ({ drafts, sent }: Params): Changes => {
  const keys = new Set(drafts.map((draft) => draft.key));
  return {
    changed: drafts.filter((draft) => sent.get(draft.key) !== JSON.stringify(draft.fields)),
    removed: [...sent.keys()].filter((key) => !keys.has(key)),
  };
};
