type Params = {
  readonly picked: string | null;
  readonly workspace: string;
};

export const guidanceToSendOf = ({ picked, workspace }: Params): string | null => {
  if (picked !== null) {
    return picked;
  }
  return workspace.trim() === '' ? null : workspace;
};
