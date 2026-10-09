export type RowHeight = {
  readonly px: number;
  readonly token: string;
  readonly height: string;
};

export const ROW_HEIGHTS: ReadonlyArray<RowHeight> = [
  { px: 24, token: 'h-6', height: 'h-6' },
  { px: 28, token: 'h-7', height: 'h-7' },
  { px: 32, token: 'h-8', height: 'h-8' },
  { px: 36, token: 'h-9', height: 'h-9' },
  { px: 40, token: 'h-10', height: 'h-10' },
  { px: 48, token: 'h-12', height: 'h-12' },
];
