type Params = {
  readonly sent: string;
  readonly current: string;
};

export const restoreDraftOnFailedSend = ({ sent, current }: Params): string => {
  if (current.trim() !== '') {
    return current;
  }
  return sent;
};
