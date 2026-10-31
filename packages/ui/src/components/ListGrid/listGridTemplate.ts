export type ListGridColumn = {
  readonly key: string;
  readonly width: number | 'fill';
  readonly align?: 'start' | 'end';
  readonly isNumeric?: boolean;
  readonly isTitle?: boolean;
  readonly tone?: 'label' | 'secondary' | 'hint';
  readonly shouldHideWhenEmpty?: boolean;
  readonly isShrinkable?: boolean;
  readonly canSpanEmpty?: boolean;
  readonly hideBelow?: number;
};

type Params = {
  readonly columns: ReadonlyArray<ListGridColumn>;
  readonly hiddenKeys?: ReadonlySet<string>;
};

export const listGridTemplate = ({ columns, hiddenKeys }: Params): string =>
  columns
    .filter((column) => hiddenKeys === undefined || !hiddenKeys.has(column.key))
    .map((column) => {
      if (column.width === 'fill') {
        return 'minmax(0,1fr)';
      }
      return column.isShrinkable === true ? `minmax(0,${column.width}px)` : `${column.width}px`;
    })
    .join(' ');
