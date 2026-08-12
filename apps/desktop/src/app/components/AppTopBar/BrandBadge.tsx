import { DogMascot } from '../../../shared/components/DogMascot';

export const BrandBadge = () => (
  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-2 py-0.5 text-primary-foreground">
    <DogMascot size={13} />
    <span className="text-xs font-semibold tracking-tight">Goodboy</span>
  </span>
);
