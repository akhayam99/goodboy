export const DOCK_GRID_CAP = { columns: 2, rows: 2 } as const satisfies {
  readonly columns: number;
  readonly rows: number;
};
