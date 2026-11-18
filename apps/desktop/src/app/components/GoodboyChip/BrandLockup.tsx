import { DogMascot, cn } from '@goodboy/ui';

const MARK_SIZE = 14;

const CHIP_CLASS =
  'goodboy-brand-chip inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md';

export const BrandLockup = () => (
  <span data-brand-chip="" className={cn(CHIP_CLASS)}>
    <DogMascot size={MARK_SIZE} className="text-foreground" />
  </span>
);
