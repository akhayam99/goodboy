import { mockSceneIpc } from '../../../mockSceneIpc';
import { sceneClock } from '../../../../sceneClock';

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

export type IphoneMoment = 'empty' | 'pairing' | 'request' | 'paired' | 'offline' | 'fault';

type Params = {
  readonly moment: IphoneMoment;
};

const clock = sceneClock({ anchor: '2026-11-27T09:30:00.000Z' });

const PERMISSIONS = { canDecide: true, canMerge: true, canStart: false } as const;

const mara = () => ({
  id: 'key-mara',
  name: "Mara's iPhone",
  pairedAt: clock.iso({ at: '2026-11-20T10:00:00.000Z' }),
  lastSeen: clock.iso({ at: '2026-11-27T09:12:00.000Z' }),
  liveSince: clock.iso({ at: '2026-11-27T09:12:00.000Z' }),
  permissions: PERMISSIONS,
});

const noa = () => ({
  id: 'key-noa',
  name: "Noa's iPhone",
  pairedAt: clock.iso({ at: '2026-11-21T10:00:00.000Z' }),
  lastSeen: clock.iso({ at: '2026-11-27T09:16:00.000Z' }),
  liveSince: null,
  permissions: { canDecide: true, canMerge: false, canStart: false },
});

const phonesOf = ({ moment }: Params) => {
  if (moment === 'paired') {
    return [mara(), noa()];
  }
  if (moment === 'offline' || moment === 'fault') {
    return [noa()];
  }
  return [];
};

const FAULT = {
  code: 'key_mismatch',
  message:
    'The pairing file and the Keychain item do not belong together. Reset pairing to start again, then scan a new code on every iPhone.',
} as const;

const REQUEST = {
  id: 'request-mara',
  name: "Mara's iPhone",
  code: '482 913',
  askedAt: clock.iso({ at: '2026-11-27T09:30:00.000Z' }),
} as const;

export const installIphoneIpc = ({ moment }: Params): void => {
  const svg = qrSvg();
  const phones = phonesOf({ moment });
  mockSceneIpc((command) => {
    if (command === 'bridge_start') {
      return {
        payload: '{}',
        svg,
        deviceName: 'Harborline MacBook',
        port: 52814,
        expiresInSecs: 60,
      };
    }
    if (command === 'bridge_link_qr') {
      return svg;
    }
    if (command === 'bridge_status') {
      return {
        running: true,
        port: 52814,
        enrolledCount: phones.length,
        isAdvertised: true,
        pendingPairing: moment === 'request' ? REQUEST : null,
        fault: moment === 'fault' ? FAULT : null,
        priorPhoneCount: phones.length,
      };
    }
    if (command === 'bridge_phones') {
      return phones;
    }
    if (command === 'bridge_link_hint') {
      return { priorPhoneCount: phones.length, fault: moment === 'fault' ? FAULT : null };
    }
    if (command === 'bridge_interfaces') {
      return [
        { name: 'Wi-Fi', addresses: ['192.168.1.24'], isSelected: true },
        { name: 'Tailscale', addresses: ['100.64.12.7'], isSelected: false },
      ];
    }
    return undefined;
  });
};
