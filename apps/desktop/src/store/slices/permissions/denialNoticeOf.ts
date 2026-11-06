type Params = {
  readonly toolName: string;
  readonly reason: string;
};

export const denialNoticeOf = ({ toolName, reason }: Params): string =>
  reason === ''
    ? `Denied ${toolName} for this one call. Do not run it; carry on another way, or say what you need.`
    : `Denied ${toolName}. ${reason}`;
