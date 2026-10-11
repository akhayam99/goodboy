type Params = {
  readonly outcome: { readonly kind: string };
  readonly isRunDismissed: boolean;
};

export const shouldHandleLateOutcome = ({ outcome, isRunDismissed }: Params): boolean => {
  if (outcome.kind === 'set-aside' || outcome.kind === 'restore-conflict') {
    return true;
  }
  return (outcome.kind === 'moved' || outcome.kind === 'files-restored') && !isRunDismissed;
};
