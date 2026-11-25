import { isRecord } from '@goodboy/types/helpers';
import { STORAGE_KEYS, persistedPref } from '../../shared/lib/storage-keys';

export type BrowserToolsSurface = 'pane' | 'page';

export type BrowserToolsSide = 'bottom' | 'right';

export type BrowserToolsPlace = {
  readonly side: BrowserToolsSide;
  readonly height: number;
  readonly width: number;
};

type Places = Readonly<Record<BrowserToolsSurface, BrowserToolsPlace>>;

type ReadParams = {
  readonly surface: BrowserToolsSurface;
};

type WriteParams = ReadParams & {
  readonly place: BrowserToolsPlace;
};

type PlaceParams = {
  readonly raw: unknown;
  readonly fallback: BrowserToolsPlace;
};

type SizeParams = {
  readonly value: unknown;
};

type ParserParams = {
  readonly fallback: Places;
};

const FIRST_PLACES = {
  pane: { side: 'bottom', height: 210, width: 360 },
  page: { side: 'right', height: 210, width: 360 },
} as const satisfies Places;

const sizeOf = ({ value }: SizeParams): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

const placeOf = ({ raw, fallback }: PlaceParams): BrowserToolsPlace => {
  if (!isRecord(raw)) {
    return fallback;
  }
  const side = raw['side'];
  const height = sizeOf({ value: raw['height'] });
  const width = sizeOf({ value: raw['width'] });
  if ((side !== 'bottom' && side !== 'right') || height === null || width === null) {
    return fallback;
  }
  return { side, height, width };
};

const placesParser =
  ({ fallback }: ParserParams) =>
  (raw: string): Places | undefined => {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return undefined;
    }
    return {
      pane: placeOf({ raw: parsed['pane'], fallback: fallback.pane }),
      page: placeOf({ raw: parsed['page'], fallback: fallback.page }),
    };
  };

const pref = persistedPref<Places>({
  key: STORAGE_KEYS.browserToolsDock,
  fallback: FIRST_PLACES,
  parse: placesParser({ fallback: FIRST_PLACES }),
});

export const browserToolsDockPref = {
  read: ({ surface }: ReadParams): BrowserToolsPlace => pref.read()[surface],
  write: ({ surface, place }: WriteParams): void =>
    pref.write({ ...pref.read(), [surface]: place }),
};
