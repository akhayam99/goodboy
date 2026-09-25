import { DogMascot } from '../../../shared/components/DogMascot';

const MARK_SIZE = 16;

export const BrandBadge = () => (
  <span
    role="img"
    aria-label="Goodboy"
    className="inline-flex shrink-0 items-center justify-center gap-2 text-foreground"
  >
    <DogMascot size={MARK_SIZE} className="text-foreground" />
    <span
      aria-hidden
      className="hidden text-sm font-semibold tracking-tight @min-chrome-word/topbar:inline"
    >
      Goodboy
    </span>
  </span>
);
