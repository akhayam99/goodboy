export const NEXT_STEP_GRID =
  'grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_4.5rem] items-center gap-x-2 rounded-md bg-subtle px-2 group-has-[[data-column=menu]>*]/next:grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_4.5rem_1.75rem]';

export const NEXT_STEP_CELLS = {
  tile: 'flex size-7 shrink-0 items-center justify-center',
  text: 'flex min-w-0 flex-col',
  primary: 'flex w-full min-w-0 items-center',
  notNow:
    'flex w-full min-w-0 items-center transition-opacity duration-150 ease-out motion-reduce:transition-none',
  menu: 'hidden size-7 items-center justify-center group-has-[[data-column=menu]>*]/next:flex',
} as const;
