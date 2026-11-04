import type { GoalAttachment, OrchestratorHint } from '@goodboy/types';
import { attachmentAbsolutePathOf } from '../../attachments/attachmentAbsolutePathOf';

type Params = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
  readonly attachments: ReadonlyArray<GoalAttachment>;
  readonly worktreeDir: string | null;
  readonly scratchDir: string | null;
};

export const hintImagePaths = ({
  hints,
  attachments,
  worktreeDir,
  scratchDir,
}: Params): Readonly<Record<string, ReadonlyArray<string>>> => {
  const byHint: Record<string, ReadonlyArray<string>> = {};
  for (const hint of hints) {
    const ids = new Set(hint.attachmentIds ?? []);
    const paths = attachments
      .filter((attachment) => attachment.kind === 'image' && ids.has(attachment.id))
      .map((attachment) =>
        attachmentAbsolutePathOf({ relPath: attachment.relPath, worktreeDir, scratchDir }),
      )
      .filter((path): path is string => path !== null);
    if (paths.length > 0) {
      byHint[hint.id] = paths;
    }
  }
  return byHint;
};
