export const NEXT_GROUP_IDS = ['decide', 'fix', 'update', 'ship'] as const;

export type NextGroupId = (typeof NEXT_GROUP_IDS)[number];
