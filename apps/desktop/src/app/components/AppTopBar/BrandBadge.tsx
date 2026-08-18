import { DogMascot } from '../../../shared/components/DogMascot';

export const BrandBadge = () => (
  <span className="inline-flex shrink-0 items-center gap-2 px-1 text-foreground">
    <DogMascot size={17} />
    <span className="text-sm font-semibold tracking-tight">Goodboy</span>
  </span>
);
