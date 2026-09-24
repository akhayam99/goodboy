import { DogMascot } from '../../../shared/components/DogMascot';

const MARK_SIZE = 16;

export const BrandBadge = () => (
  <span
    role="img"
    aria-label="Goodboy"
    className="hidden shrink-0 items-center justify-center gap-2 text-foreground brand-mark:inline-flex"
  >
    <DogMascot size={MARK_SIZE} className="text-foreground" />
    <span aria-hidden className="hidden text-sm font-semibold tracking-tight brand-word:inline">
      Goodboy
    </span>
  </span>
);
