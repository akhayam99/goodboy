import type { MountId } from '@goodboy/types';

type MountParams = {
  readonly mountId: MountId;
};

type RawParams = {
  readonly raw: string | null | undefined;
};

export const setupOfferKey = ({ mountId }: MountParams): string =>
  `worktree.setup-offer.${mountId}`;

export const carryPathsOf = ({ raw }: RawParams): ReadonlyArray<string> => {
  if (raw === null || raw === undefined) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === 'string' && entry !== '');
  } catch {
    return [];
  }
};

type PathsParams = {
  readonly paths: ReadonlyArray<string>;
};

type OfferParams = {
  readonly offer: SetupOffer;
};

type StateParams = {
  readonly value: unknown;
};

export const carryValueOf = ({ paths }: PathsParams): string =>
  JSON.stringify([...new Set(paths)].sort());

export const setupCommandOf = ({ raw }: RawParams): string | null | undefined => {
  if (raw === null || raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
};

type SetupOfferState = 'offered' | 'dismissed' | 'done';

export type SetupOffer = {
  readonly command: string | null;
  readonly carried: number;
  readonly skipped: number;
  readonly state: SetupOfferState;
};

const offerStateOf = ({ value }: StateParams): SetupOfferState | null =>
  value === 'offered' || value === 'dismissed' || value === 'done' ? value : null;

export const setupOfferOf = ({ raw }: RawParams): SetupOffer | null => {
  if (raw === null || raw === undefined) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const command = Reflect.get(parsed, 'command');
    const carried = Reflect.get(parsed, 'carried');
    const skipped = Reflect.get(parsed, 'skipped');
    const state = offerStateOf({ value: Reflect.get(parsed, 'state') });
    if (
      (command !== null && typeof command !== 'string') ||
      command === '' ||
      typeof carried !== 'number' ||
      typeof skipped !== 'number' ||
      state === null
    ) {
      return null;
    }
    return { command: command ?? null, carried, skipped, state };
  } catch {
    return null;
  }
};

export const setupOfferValueOf = ({ offer }: OfferParams): string => JSON.stringify(offer);
