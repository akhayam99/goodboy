import type { ReactNode } from 'react';
import { cn } from '../cn';
import { Divider } from './Divider';

const RAIL_WIDTH_CLASSES = {
  narrow: 'w-64',
  standard: 'w-72',
  wide: 'w-80',
  xwide: 'w-[26rem]',
} satisfies Record<string, string>;

const RAIL_VISIBILITY_CLASSES = {
  always: { root: '', rail: 'flex', divider: '' },
  wideContainer: {
    root: '@container',
    rail: 'hidden @min-[1265px]:flex',
    divider: 'hidden @min-[1265px]:block',
  },
} satisfies Record<
  string,
  { readonly root: string; readonly rail: string; readonly divider: string }
>;

type Props = {
  readonly rail: ReactNode;
  readonly detail: ReactNode;
  readonly railLabel: string;
  readonly railWidth: keyof typeof RAIL_WIDTH_CLASSES;
  readonly railVisibility?: keyof typeof RAIL_VISIBILITY_CLASSES;
};

export const StudioRailLayout = ({
  rail,
  detail,
  railLabel,
  railWidth,
  railVisibility = 'always',
}: Props) => {
  const visibility = RAIL_VISIBILITY_CLASSES[railVisibility];
  return (
    <div className={cn('flex h-full min-h-0 flex-1', visibility.root)}>
      <aside
        aria-label={railLabel}
        className={cn('min-h-0 shrink-0 flex-col', visibility.rail, RAIL_WIDTH_CLASSES[railWidth])}
      >
        {rail}
      </aside>
      <Divider orientation="vertical" className={visibility.divider} />
      <div className="min-h-0 flex-1">{detail}</div>
    </div>
  );
};
