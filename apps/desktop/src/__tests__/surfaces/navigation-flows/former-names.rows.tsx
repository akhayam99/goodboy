import { band, both, heading, openPalette, type Row } from './harness';

export const FORMER_NAME_ROWS: ReadonlyArray<Row> = [
  {
    name: 'searching Rules finds Run defaults',
    covers: ['studio:workflow'],
    open: () => openPalette(/^Run defaults/, 'Rules'),
    lands: both(
      () => band('Workflows'),
      () => heading('Run defaults'),
    ),
  },
  {
    name: 'searching Workflow rules finds Run defaults',
    covers: ['studio:workflow'],
    open: () => openPalette(/^Run defaults/, 'Workflow rules'),
    lands: both(
      () => band('Workflows'),
      () => heading('Run defaults'),
    ),
  },
];
