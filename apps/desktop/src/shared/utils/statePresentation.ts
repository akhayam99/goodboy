import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@goodboy/ui';

export type StatePresentation = {
  readonly label: string;
  readonly reason: string;
  readonly tone: Tone;
  readonly icon: LucideIcon;
};

type DescriptionParams = {
  readonly presentation: StatePresentation;
  readonly subject?: string | null;
};

export const stateDescription = ({ presentation, subject = null }: DescriptionParams): string => {
  const head =
    subject === null || subject === ''
      ? presentation.label
      : `${subject} ${presentation.label.toLowerCase()}`;
  return presentation.reason === '' ? head : `${head}, ${presentation.reason}`;
};
