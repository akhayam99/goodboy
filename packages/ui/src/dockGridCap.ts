export const DOCK_GRID_CAP = { columns: 4, rows: 2 } as const satisfies {
  readonly columns: number;
  readonly rows: number;
};
