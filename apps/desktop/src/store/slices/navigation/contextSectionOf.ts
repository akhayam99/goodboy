import type { ContextDrawerSection } from '../drawer/state';

type Params = {
  readonly lens: string;
};

export const contextSectionOf = ({ lens }: Params): ContextDrawerSection | null => {
  if (lens === 'goal') {
    return 'goal';
  }
  if (lens === 'decisions') {
    return 'decisions';
  }
  if (lens === 'last_output_summary') {
    return 'summary';
  }
  return null;
};
