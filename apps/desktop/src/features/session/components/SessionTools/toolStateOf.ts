type ToolState = 'rest' | 'pressed' | 'current';

type Params = {
  readonly isOpen: boolean;
  readonly isCurrent?: boolean;
};

export const toolStateOf = ({ isOpen, isCurrent = false }: Params): ToolState => {
  if (isCurrent) {
    return 'current';
  }
  if (isOpen) {
    return 'pressed';
  }
  return 'rest';
};
