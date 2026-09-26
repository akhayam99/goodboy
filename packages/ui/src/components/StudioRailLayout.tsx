import type { ReactNode } from 'react';
import { cn } from '../cn';
import { SHEET_CLASSES } from '../sheet';

const RAIL_WIDTH_CLASSES = {
  narrow: 'w-64',
  standard: 'w-72',
  wide: 'w-80',
  xwide: 'w-[26rem]',
} satisfies Record<string, string>;

type Props = {
  readonly rail: ReactNode;
  readonly detail: ReactNode;
  readonly railLabel: string;
  readonly railWidth: keyof typeof RAIL_WIDTH_CLASSES;
};

export const StudioRailLayout = ({ rail, detail, railLabel, railWidth }: Props) => (
  <div data-studio-rail="" className="flex h-full min-h-0 flex-1 bg-chrome">
    <aside
      aria-label={railLabel}
      className={cn('flex min-h-0 shrink-0 flex-col', RAIL_WIDTH_CLASSES[railWidth])}
    >
      {rail}
    </aside>
    <div
      data-sheet="wrapped"
      className={cn('min-h-0 min-w-0 flex-1 overflow-hidden bg-background', SHEET_CLASSES.wrapped)}
    >
      {detail}
    </div>
  </div>
);
