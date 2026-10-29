import type { GoalAttachment, OrchestratorHint } from '@goodboy/types';
import { hintImagePaths } from '../workflows/hintImagePaths';

type Params = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
  readonly attachments: ReadonlyArray<GoalAttachment>;
  readonly worktreeDir: string | null;
  readonly stepNumber: number;
};

export type HintImagesBlock = {
  readonly text: string;
  readonly attachmentIds: ReadonlySet<string>;
};

const EMPTY: HintImagesBlock = { text: '', attachmentIds: new Set() };

export const buildHintImagesBlock = ({
  hints,
  attachments,
  worktreeDir,
  stepNumber,
}: Params): HintImagesBlock => {
  const acted = hints.filter((hint) => hint.consumedAtStep === stepNumber);
  const pathsByHint = hintImagePaths({ hints: acted, attachments, worktreeDir });
  const withImages = acted.filter((hint) => pathsByHint[hint.id] !== undefined);
  if (withImages.length === 0) {
    return EMPTY;
  }
  const text = withImages
    .map((hint) => {
      const [first = ''] = hint.text.split(/\r?\n/);
      const paths = pathsByHint[hint.id] ?? [];
      return [
        `**Images from the user's hint: ${first}** read each path with your Read tool before relying on it:`,
        ...paths.map((path) => `- ${path}`),
      ].join('\n');
    })
    .join('\n\n');
  return {
    text,
    attachmentIds: new Set(withImages.flatMap((hint) => hint.attachmentIds ?? [])),
  };
};
