type Params = {
  readonly listId: string;
  readonly key: string;
};

export const taskPickerOptionId = ({ listId, key }: Params): string =>
  `${listId}-task-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
