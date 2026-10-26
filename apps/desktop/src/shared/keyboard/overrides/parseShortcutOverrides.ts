import { isRebindable } from './isRebindable';
import { isValidCombo } from './isValidCombo';
import { normalizeCombo } from './normalizeCombo';

type Params = {
  readonly raw: string | undefined;
};

export const parseShortcutOverrides = ({ raw }: Params): Readonly<Record<string, string>> => {
  if (raw === undefined) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(parsed).flatMap(([id, combo]): ReadonlyArray<readonly [string, string]> => {
      if (typeof combo !== 'string' || !isValidCombo({ combo }) || !isRebindable({ id })) {
        return [];
      }
      return [[id, normalizeCombo({ combo })]];
    }),
  );
};
