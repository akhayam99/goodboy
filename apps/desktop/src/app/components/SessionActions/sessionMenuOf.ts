type Params = {
  readonly isArchived: boolean;
};

const OPEN_MENU_IDS: ReadonlyArray<string> = [
  'session.ask',
  'session.pin',
  'session.unpin',
  'session.refresh',
  'session.archive',
  'session.delete',
];

const ARCHIVED_MENU_IDS: ReadonlyArray<string> = ['session.restore', 'session.delete'];

export const sessionMenuOf = ({ isArchived }: Params): ReadonlyArray<string> =>
  isArchived ? ARCHIVED_MENU_IDS : OPEN_MENU_IDS;
