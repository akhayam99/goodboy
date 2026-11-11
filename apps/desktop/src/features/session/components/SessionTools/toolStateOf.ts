type ToolState = 'rest' | 'pressed' | 'waiting' | 'current';

type Params = {
  readonly isOpen: boolean;
  readonly isWaiting: boolean;
  readonly isCurrent?: boolean;
};

export const toolStateOf = ({ isOpen, isWaiting, isCurrent = false }: Params): ToolState => {
  if (isCurrent) {
    return 'current';
  }
  if (isOpen) {
    return 'pressed';
  }
  return isWaiting ? 'waiting' : 'rest';
};
