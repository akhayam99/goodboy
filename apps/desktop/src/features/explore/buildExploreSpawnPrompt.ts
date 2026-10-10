type Params = {
  readonly ask: string;
  readonly relPath: string;
  readonly absolutePath: string;
};

type BlockParams = {
  readonly relPath: string;
  readonly absolutePath: string;
};

const composeExploreAttachmentBlock = ({ relPath, absolutePath }: BlockParams): string =>
  `**Attached** (this message) read each path with your Read tool before relying on it:\n- ${relPath} (${absolutePath})`;

export const buildExploreSpawnPrompt = ({ ask, relPath, absolutePath }: Params): string => {
  const trimmedAsk = ask.trim();
  return [trimmedAsk, composeExploreAttachmentBlock({ relPath, absolutePath })].join('\n\n');
};
