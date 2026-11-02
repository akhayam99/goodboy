import { countNoun } from '../../shared/utils/countNoun';
export const RESOLVE_ITEM_LABEL = {
  rereadInstruction: 'Read this comment again and fix it.',
} as const;

export const changeSummaryLine = ({
  fileCount,
  changedLines,
}: {
  readonly fileCount: number;
  readonly changedLines: number;
}): string =>
  `${countNoun({ count: fileCount, one: 'file' })} · ${changedLines} changed ${changedLines === 1 ? 'line' : 'lines'}`;

export const shortSha = ({ sha }: { readonly sha: string }): string => sha.slice(0, 7);
