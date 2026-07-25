import type { ModelFamily } from '@goodboy/types';
import {
  FAMILY_SECTION_LABEL,
  modelWeight,
  parseModelId,
  subfamilyLabel,
} from '../../../features/chat/utils/chat-constants';

type Params = {
  readonly ids: ReadonlyArray<string>;
};

export type ModelGroup = {
  readonly family: ModelFamily;
  readonly label: string;
  readonly subgroups: ReadonlyArray<{
    readonly key: string;
    readonly label: string | null;
    readonly ids: ReadonlyArray<string>;
  }>;
};

export const groupModels = ({ ids }: Params): ReadonlyArray<ModelGroup> => {
  const byFamily = new Map<ModelFamily, Map<string | null, string[]>>();
  for (const id of [...ids].sort((a, b) => modelWeight(a) - modelWeight(b))) {
    const parsed = parseModelId(id);
    const subgroups = byFamily.get(parsed.family) ?? new Map<string | null, string[]>();
    byFamily.set(parsed.family, subgroups);
    subgroups.set(parsed.subfamily, [...(subgroups.get(parsed.subfamily) ?? []), id]);
  }
  return [...byFamily.entries()].map(([family, subgroups]) => ({
    family,
    label: FAMILY_SECTION_LABEL[family] ?? family,
    subgroups: [...subgroups.entries()].map(([subfamily, groupIds]) => ({
      key: subfamily ?? '_flat',
      label: subfamily === null ? null : subfamilyLabel(family, subfamily),
      ids: groupIds,
    })),
  }));
};
