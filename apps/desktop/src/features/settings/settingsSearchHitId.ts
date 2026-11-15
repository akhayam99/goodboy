type Params = {
  readonly listId: string;
  readonly index: number;
};

export const settingsSearchHitId = ({ listId, index }: Params): string => `${listId}-${index}`;
