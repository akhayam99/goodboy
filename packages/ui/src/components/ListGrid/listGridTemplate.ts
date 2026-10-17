export type ListGridColumn = {
  readonly key: string;
  readonly width: number | 'fill';
  readonly align?: 'start' | 'end';
  readonly isNumeric?: boolean;
  readonly isTitle?: boolean;
  readonly tone?: 'label' | 'secondary' | 'hint';
  readonly shouldHideWhenEmpty?: boolean;
};

type Params = {
  readonly columns: ReadonlyArray<ListGridColumn>;
  readonly hiddenKeys?: ReadonlySet<string>;
};

export const listGridTemplate = ({ columns, hiddenKeys }: Params): string =>
  columns
    .filter((column) => hiddenKeys === undefined || !hiddenKeys.has(column.key))
    .map((column) => (column.width === 'fill' ? 'minmax(0,1fr)' : `${column.width}px`))
    .join(' ');
