import { both, heading, lens, openPalette, studio, type Row } from './harness';

export const FORMER_NAME_ROWS: ReadonlyArray<Row> = [
  {
    name: 'searching Rules finds Run defaults',
    covers: ['studio:workflow'],
    door: 'palette',
    open: () => openPalette(/^Run defaults/, 'Rules'),
    lands: both(
      () => studio('Workflows'),
      () => heading('Run defaults'),
    ),
  },
  {
    name: 'searching Workflow rules finds Run defaults',
    covers: ['studio:workflow'],
    door: 'palette',
    open: () => openPalette(/^Run defaults/, 'Workflow rules'),
    lands: both(
      () => studio('Workflows'),
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
    door: 'palette',
    open: () => openPalette(/^What's new/, 'Changelog'),
    lands: both(
      () => studio("What's new"),
      () => heading(/^Goodboy \d/),
    ),
  },
  {
    name: 'searching Pair your iPhone finds Pair an iPhone',
    covers: ['settings:iphone', 'palette:Pair an iPhone'],
    door: 'palette',
    open: () => openPalette(/^Pair an iPhone/, 'Pair your iPhone'),
    lands: both(
      () => studio('Settings'),
      () => heading('iPhone'),
    ),
  },
  {
    name: 'searching Shortcuts finds Keyboard shortcuts',
    covers: ['settings:shortcuts', 'palette:Keyboard shortcuts'],
    open: () => openPalette(/^Keyboard shortcuts/, 'Shortcuts'),
    lands: () => heading('Keyboard shortcuts'),
  },
  {
    name: 'searching Guide: Commits opens that Guide chapter',
    covers: ['studio:guide', 'palette:Guide: Commits'],
    door: 'palette',
    open: () => openPalette(/^Guide: Commits/, 'Guide: Commits'),
    lands: () => studio('Guide'),
  },
  {
    name: 'searching Inbox finds Tasks',
    covers: ['studio:inbox'],
    door: 'palette',
    open: () => openPalette(/^Tasks$/, 'Inbox'),
    lands: both(
      () => studio('Tasks'),
      () => heading(/^Tasks$/),
    ),
  },
];
