import { extractFanOut } from '@goodboy/core';
import type { PlanWithCount } from '@goodboy/types';
import type { SpawnAssignment } from '../../../../shared/utils/spawnedChildren';
import type { TranscriptItem } from '../../utils/transcript-items';

export type SpawnRecord = Readonly<{
  anchorKey: string | null;
  assignments: ReadonlyArray<SpawnAssignment>;
}>;

type Params = {
  readonly items: ReadonlyArray<TranscriptItem>;
  readonly plan: PlanWithCount | null;
};

const KICKOFF_KINDS = new Set<TranscriptItem['kind']>(['user_text', 'workflow_kickoff']);

export const selectSpawnRecord = ({ items, plan }: Params): SpawnRecord => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.kind !== 'assistant_text') {
      continue;
    }
    const areas = extractFanOut(item.text);
    if (areas == null) {
      continue;
    }
    return {
      anchorKey: item.key,
      assignments: areas.map((area) => ({ name: area.area, text: area.query })),
    };
  }
  const kickoff = items.find((item) => KICKOFF_KINDS.has(item.kind)) ?? null;
  const clusters = plan?.clusters ?? [];
  return {
    anchorKey: kickoff?.key ?? null,
    assignments: clusters.map((cluster) => ({
      name: cluster.title,
      text: cluster.instructions,
    })),
  };
};
