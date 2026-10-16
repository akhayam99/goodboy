export type ListGridColumn = {
  readonly key: string;
  readonly width: number | 'fill';
  readonly align?: 'start' | 'end';
  readonly isNumeric?: boolean;
  readonly isTitle?: boolean;
  readonly tone?: 'label' | 'secondary' | 'hint';
};

type Params = {
  readonly columns: ReadonlyArray<ListGridColumn>;
};

export const listGridTemplate = ({ columns }: Params): string =>
  columns
    .map((column) => (column.width === 'fill' ? 'minmax(0,1fr)' : `${column.width}px`))
    .join(' ');
