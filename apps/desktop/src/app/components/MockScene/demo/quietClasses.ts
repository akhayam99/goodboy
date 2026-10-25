import { cn } from '@goodboy/ui';

type Params = {
  readonly isQuiet: boolean;
};

export const quietClasses = ({ isQuiet }: Params): string =>
  cn(
    'motion-safe:transition-opacity motion-safe:duration-150',
    isQuiet && 'opacity-40 hover:opacity-100 focus-within:opacity-100',
  );
