import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';

export type ToneBarDensity = 'card' | 'row';

type Props = {
  readonly tone: Tone;
  readonly density: ToneBarDensity;
  readonly isBreathing?: boolean;
  readonly className?: string;
};

const DENSITY_CLASSES: Record<ToneBarDensity, string> = {
  card: 'left-1.5 top-3 bottom-3 w-0.75',
  row: 'left-1 top-2.25 bottom-2.25 w-0.5',
};

export const ToneBar = ({ tone, density, isBreathing = false, className }: Props) => (
  <span
    aria-hidden
    data-testid="tone-bar"
    className={cn(
      'pointer-events-none absolute rounded-full',
      DENSITY_CLASSES[density],
      tintClasses(tone).dot,
      isBreathing && 'motion-safe:animate-soft-pulse',
      className,
    )}
  />
);
