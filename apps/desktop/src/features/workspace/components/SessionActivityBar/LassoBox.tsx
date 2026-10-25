import { cn, tintClasses } from '@goodboy/ui';

type Props = {
  readonly rect: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
};

export const LassoBox = ({ rect }: Props) => (
  <div
    aria-hidden
    style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    className={cn(
      'pointer-events-none absolute z-10 rounded-sm border',
      tintClasses('primary').border,
      tintClasses('primary').bg,
    )}
  />
);
