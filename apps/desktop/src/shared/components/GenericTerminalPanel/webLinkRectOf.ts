import type { IViewportRange, Terminal } from '@xterm/xterm';

export type TerminalLinkRect = {
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
};

type Params = {
  readonly term: Terminal;
  readonly location: IViewportRange;
};

export const webLinkRectOf = ({ term, location }: Params): TerminalLinkRect | null => {
  const screen = term.element?.querySelector('.xterm-screen');
  if (screen == null || term.cols === 0 || term.rows === 0) {
    return null;
  }
  const box = screen.getBoundingClientRect();
  const cellWidth = box.width / term.cols;
  const cellHeight = box.height / term.rows;
  const isOneRow = location.start.y === location.end.y;
  return {
    top: box.top + (location.start.y - 1) * cellHeight,
    bottom: box.top + location.start.y * cellHeight,
    left: box.left + (location.start.x - 1) * cellWidth,
    right: box.left + (isOneRow ? location.end.x : term.cols) * cellWidth,
  };
};
