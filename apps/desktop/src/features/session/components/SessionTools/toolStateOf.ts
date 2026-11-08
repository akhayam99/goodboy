export type ToolState = 'rest' | 'pressed' | 'waiting';

type Params = {
  readonly isOpen: boolean;
  readonly isWaiting: boolean;
};

export const toolStateOf = ({ isOpen, isWaiting }: Params): ToolState => {
  if (isOpen) {
    return 'pressed';
  }
  return isWaiting ? 'waiting' : 'rest';
};
