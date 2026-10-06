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
  `${fileCount} ${fileCount === 1 ? 'file' : 'files'} · ${changedLines} changed ${changedLines === 1 ? 'line' : 'lines'}`;

export const shortSha = ({ sha }: { readonly sha: string }): string => sha.slice(0, 7);
