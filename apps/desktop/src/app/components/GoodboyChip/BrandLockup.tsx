import { DogMascot, Eyebrow, cn } from '@goodboy/ui';

type Props = {
  readonly version: string | null;
  readonly isMarkOnly?: boolean;
};

const MARK_SIZE = 14;

const CHIP_CLASS = 'goodboy-brand-chip inline-flex h-5 shrink-0 items-center rounded-md';

export const BrandLockup = ({ version, isMarkOnly = false }: Props) => {
  if (isMarkOnly) {
    return (
      <span data-brand-chip="" className={cn(CHIP_CLASS, 'w-5 justify-center')}>
        <DogMascot size={MARK_SIZE} className="text-foreground" />
      </span>
    );
  }
  return (
    <span data-brand-lockup="" className="flex min-w-0 items-center gap-2">
      <span data-brand-chip="" className={cn(CHIP_CLASS, 'gap-1 pl-1 pr-2')}>
        <DogMascot size={MARK_SIZE} className="text-foreground" />
        <span className="text-chip text-foreground">Goodboy</span>
      </span>
      <Eyebrow label="Beta" muted />
      {version === null ? null : (
        <span className="truncate tabular-nums text-faint-foreground">v{version}</span>
      )}
    </span>
  );
};
