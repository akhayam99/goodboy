type Params = {
  readonly status: 'idle' | 'running' | 'error';
  readonly hasChange: boolean;
};

export const contextNoteOf = ({ status, hasChange }: Params): string | null => {
  if (status === 'running') {
    return 'Updating context';
  }
  if (status === 'error') {
    return "Couldn't update the context. Open to retry.";
  }
  return hasChange ? 'Decisions changed since you last looked' : null;
};
