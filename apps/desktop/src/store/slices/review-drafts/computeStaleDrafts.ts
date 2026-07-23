import type { FileDiff, PrReviewDraft } from '@goodboy/types';

type Params = {
  readonly drafts: ReadonlyArray<PrReviewDraft>;
  readonly files: ReadonlyArray<FileDiff>;
};

type Result = {
  readonly fresh: ReadonlyArray<PrReviewDraft>;
  readonly stale: ReadonlyArray<PrReviewDraft>;
};

export const computeStaleDrafts = ({ drafts, files }: Params): Result => {
  const newLines = new Set<string>();
  const oldLines = new Set<string>();
  for (const file of files) {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.newLine != null && (line.kind === 'add' || line.kind === 'context')) {
          newLines.add(`${file.path}:${line.newLine}`);
        }
        if (line.oldLine != null && (line.kind === 'del' || line.kind === 'context')) {
          oldLines.add(`${file.oldPath ?? file.path}:${line.oldLine}`);
        }
      }
    }
  }
  const fresh: PrReviewDraft[] = [];
  const stale: PrReviewDraft[] = [];
  for (const draft of drafts) {
    const key = `${draft.path}:${draft.line}`;
    const anchored = draft.side === 'new' ? newLines.has(key) : oldLines.has(key);
    if (anchored) {
      fresh.push(draft);
      continue;
    }
    stale.push({ ...draft, stale: true });
  }
  return { fresh, stale };
};
