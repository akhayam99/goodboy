type Params = {
  readonly listId: string;
  readonly index: number;
};

export const sessionOptionId = ({ listId, index }: Params): string => `${listId}-option-${index}`;
