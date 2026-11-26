import type { PortColumns } from './portColumns';

export const PORT_GRIDS = {
  full: 'grid grid-cols-[0.5rem_4.5rem_6rem_minmax(0,1.6fr)_minmax(0,1fr)_3.5rem_3.5rem_4.5rem_7.5rem] items-center gap-3 px-2',
  compact:
    'grid grid-cols-[0.5rem_4rem_minmax(0,1.4fr)_minmax(0,1fr)_3rem_4rem_7.5rem] items-center gap-2 px-2',
  narrow:
    'grid grid-cols-[0.5rem_3.5rem_minmax(0,1.4fr)_minmax(0,1fr)_7.5rem] items-center gap-2 px-2',
} as const satisfies Record<PortColumns, string>;
