type Params = {
  readonly picked: string | null;
  readonly workspace: string;
};

export const guidanceShownOf = ({ picked, workspace }: Params): string => picked ?? workspace;
