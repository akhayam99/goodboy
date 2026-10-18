type Params = Readonly<{
  folderPath: string;
  runId: string;
  relativePath: string;
}>;

export const folderChangeKey = ({ folderPath, runId, relativePath }: Params): string =>
  `${folderPath}\n${runId}\n${relativePath}`;
