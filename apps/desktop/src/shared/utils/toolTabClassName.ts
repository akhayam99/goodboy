import { cn } from '@goodboy/ui';

type Params = {
  readonly isSelected: boolean;
};

export const toolTabClassName = ({ isSelected }: Params): string =>
  cn(
    'group flex h-7 min-w-0 max-w-48 shrink-0 items-center gap-2 rounded-md pl-3 pr-1 text-ui text-muted-foreground',
    'cursor-pointer select-none hover:bg-hover hover:text-foreground motion-safe:transition-colors',
    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring',
    isSelected && 'bg-selected text-foreground',
  );
