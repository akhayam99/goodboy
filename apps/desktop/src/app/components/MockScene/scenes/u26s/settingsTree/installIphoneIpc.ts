import { mockSceneIpc } from '../../mockSceneIpc';

const QR_CELLS = 25;
const QR_CELL_PX = 8;
const FINDER_CELLS = 7;

type Cell = {
  readonly row: number;
  readonly column: number;
};

const isFinderCell = ({ row, column }: Cell): boolean => {
  if (row >= FINDER_CELLS || column >= FINDER_CELLS) {
    return false;
  }
  const isRing = row === 0 || row === 6 || column === 0 || column === 6;
  const isCore = row > 1 && row < 5 && column > 1 && column < 5;
  return isRing || isCore;
};

const isDark = ({ row, column }: Cell): boolean => {
  const corners: ReadonlyArray<Cell> = [
    { row, column },
    { row, column: QR_CELLS - 1 - column },
    { row: QR_CELLS - 1 - row, column },
  ];
  if (corners.some((corner) => corner.row <= FINDER_CELLS && corner.column <= FINDER_CELLS)) {
    return corners.some(isFinderCell);
  }
  return ((row * 73 + column * 151) ^ (row * column * 37)) % 7 < 3;
};

const qrSvg = (): string => {
  const size = QR_CELLS * QR_CELL_PX;
  const cells = Array.from({ length: QR_CELLS * QR_CELLS }, (_, index) => ({
    row: Math.floor(index / QR_CELLS),
    column: index % QR_CELLS,
  }))
    .filter(isDark)
    .map(
      ({ row, column }) =>
        `<rect x="${column * QR_CELL_PX}" y="${row * QR_CELL_PX}" width="${QR_CELL_PX}" height="${QR_CELL_PX}"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="#111">${cells}</svg>`;
};

type Params = {
  readonly enrolledCount: number;
};

export const installIphoneIpc = ({ enrolledCount }: Params): void => {
  const svg = qrSvg();
  mockSceneIpc((command) => {
    if (command === 'bridge_start') {
      return {
        payload: '{}',
        svg,
        deviceName: 'Harborline MacBook',
        port: 47821,
        expiresInSecs: 60,
      };
    }
    if (command === 'bridge_status') {
      return { running: true, port: 47821, enrolledCount };
    }
    return undefined;
  });
};
