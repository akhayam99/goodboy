export type StagedFlowAction = 'continue' | 'send';

export type StagedFlow = {
  readonly index: number;
  readonly total: number;
  readonly showsStepper: boolean;
  readonly canGoBack: boolean;
  readonly action: StagedFlowAction;
};

type Params = {
  readonly total: number;
  readonly index: number;
};

export const resolveStagedFlow = ({ total, index }: Params): StagedFlow => {
  const safeTotal = total > 0 ? total : 0;
  const lastIndex = safeTotal > 0 ? safeTotal - 1 : 0;
  const clamped = index < 0 ? 0 : index;
  const safeIndex = clamped > lastIndex ? lastIndex : clamped;

  return {
    index: safeIndex,
    total: safeTotal,
    showsStepper: safeTotal > 1,
    canGoBack: safeTotal > 1 && safeIndex > 0,
    action: safeIndex >= lastIndex ? 'send' : 'continue',
  };
};
