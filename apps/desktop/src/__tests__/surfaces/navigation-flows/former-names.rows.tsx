import { band, both, heading, lens, openPalette, type Row } from './harness';

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
  {
    name: 'searching Open Workflows finds Open Runs in a session',
    covers: ['palette:Open Runs'],
    open: () => openPalette(/^Open Runs/, 'Open Workflows'),
    lands: both(lens('workflows'), () => heading('Runs')),
  },
  {
    name: 'searching Workflow runs finds Open Runs in a session',
    covers: ['palette:Open Runs'],
    open: () => openPalette(/^Open Runs/, 'Workflow runs'),
    lands: both(lens('workflows'), () => heading('Runs')),
  },
  {
    name: "searching Changelog finds What's new",
    covers: ['studio:changelog'],
    open: () => openPalette(/^What's new/, 'Changelog'),
    lands: both(
      () => band("What's new"),
      () => heading(/^Goodboy \d/),
    ),
  },
  {
    name: 'searching Inbox finds Tasks',
    covers: ['studio:inbox'],
    open: () => openPalette(/^Tasks$/, 'Inbox'),
    lands: both(
      () => band('Tasks'),
      () => heading('All items'),
    ),
  },
];
