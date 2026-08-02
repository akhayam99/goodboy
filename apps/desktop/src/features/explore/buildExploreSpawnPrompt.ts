type Params = {
  readonly ask: string;
  readonly relPath: string;
};

const composeExploreAttachmentBlock = ({ relPath }: { readonly relPath: string }): string =>
  `**Attached** (this message) read each path with your Read tool before relying on it:\n- ${relPath}`;

export const buildExploreSpawnPrompt = ({ ask, relPath }: Params): string => {
  const trimmedAsk = ask.trim();
  return [trimmedAsk, composeExploreAttachmentBlock({ relPath })].join('\n\n');
};
