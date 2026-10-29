import type { GoalAttachment, OrchestratorHint } from '@goodboy/types';

type Params = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
  readonly attachments: ReadonlyArray<GoalAttachment>;
  readonly worktreeDir: string | null;
};

export const hintImagePaths = ({
  hints,
  attachments,
  worktreeDir,
}: Params): Readonly<Record<string, ReadonlyArray<string>>> => {
  const byHint: Record<string, ReadonlyArray<string>> = {};
  if (worktreeDir == null) {
    return byHint;
  }
  const root = worktreeDir.endsWith('/') ? worktreeDir : `${worktreeDir}/`;
  for (const hint of hints) {
    const ids = new Set(hint.attachmentIds ?? []);
    const paths = attachments
      .filter((attachment) => attachment.kind === 'image' && ids.has(attachment.id))
      .map((attachment) => `${root}${attachment.relPath}`);
    if (paths.length > 0) {
      byHint[hint.id] = paths;
    }
  }
  return byHint;
};
