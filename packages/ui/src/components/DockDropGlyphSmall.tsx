import type { DockZonePlacement } from '../dockDropZonesOf';

type Props = {
  readonly placement: DockZonePlacement;
};

const FRAME = { x: 1.5, y: 2.5, width: 13, height: 11 } as const;

const FILLS: Readonly<
  Record<
    Exclude<DockZonePlacement, 'merge'>,
    { x: number; y: number; width: number; height: number }
  >
> = {
  left: { x: 1.5, y: 2.5, width: 5, height: 11 },
  right: { x: 9.5, y: 2.5, width: 5, height: 11 },
  above: { x: 1.5, y: 2.5, width: 13, height: 4.5 },
  below: { x: 1.5, y: 9, width: 13, height: 4.5 },
};

export const DockDropGlyphSmall = ({ placement }: Props) => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    aria-hidden
    data-dock-glyph={placement}
  >
    <rect {...FRAME} rx={2.5} />
    {placement === 'merge' ? (
      <>
        <path d="M1.5 6.5h13" />
        <path d="M3.5 6.5V4.5h4v2" fill="currentColor" />
      </>
    ) : (
      <rect {...FILLS[placement]} rx={1.5} fill="currentColor" stroke="none" />
    )}
  </svg>
);
