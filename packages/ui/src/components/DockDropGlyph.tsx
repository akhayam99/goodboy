import type { DockZonePlacement } from '../dockDropZonesOf';

type Props = {
  readonly placement: DockZonePlacement;
};

const FRAME = { x: 1, y: 1, width: 26, height: 18 } as const;

const FILLS: Readonly<
  Record<
    Exclude<DockZonePlacement, 'merge'>,
    { x: number; y: number; width: number; height: number }
  >
> = {
  left: { x: 1, y: 1, width: 9, height: 18 },
  right: { x: 18, y: 1, width: 9, height: 18 },
  above: { x: 1, y: 1, width: 26, height: 7 },
  below: { x: 1, y: 12, width: 26, height: 7 },
};

export const DockDropGlyph = ({ placement }: Props) => (
  <svg
    width={28}
    height={20}
    viewBox="0 0 28 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden
    data-dock-glyph={placement}
  >
    <rect {...FRAME} rx={3} />
    {placement === 'merge' ? (
      <>
        <path d="M1 7h26" />
        <path d="M5 7V4.5h7V7" fill="currentColor" />
      </>
    ) : (
      <rect {...FILLS[placement]} rx={2} fill="currentColor" stroke="none" />
    )}
  </svg>
);
