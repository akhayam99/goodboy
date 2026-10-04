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

const joinable = (reason: string): string => {
  const first = reason.charAt(0);
  const second = reason.charAt(1);
  const isWord = first !== first.toLowerCase() && second === second.toLowerCase();
  return isWord ? `${first.toLowerCase()}${reason.slice(1)}` : reason;
};

export const stateDescription = ({ presentation, subject = null }: DescriptionParams): string => {
  const head =
    subject === null || subject === ''
      ? presentation.label
      : `${subject} ${presentation.label.toLowerCase()}`;
  return presentation.reason === '' ? head : `${head}, ${joinable(presentation.reason)}`;
};
