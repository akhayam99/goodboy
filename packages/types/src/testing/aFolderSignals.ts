import type { FolderFileKind, FolderSignals } from '../folder';

const NO_FILES: Readonly<Record<FolderFileKind, number>> = {
  markdown: 0,
  text: 0,
  pdf: 0,
  word: 0,
  pages: 0,
  keynote: 0,
  numbers: 0,
  excel: 0,
  powerpoint: 0,
  image: 0,
  video: 0,
  audio: 0,
  source: 0,
  other: 0,
};

type Overrides = Partial<Omit<FolderSignals, 'counts'>> & {
  readonly counts?: Partial<Record<FolderFileKind, number>>;
};

export const aFolderSignals = ({ counts = {}, ...overrides }: Overrides = {}): FolderSignals => {
  const all = { ...NO_FILES, ...counts };
  const totalFiles = Object.values(all).reduce((total, count) => total + count, 0);
  return {
    path: '/mock/Documents/acme-notes',
    markers: [],
    counts: all,
    totalFiles,
    totalBytes: 42_000_000,
    entriesRead: totalFiles,
    isTruncated: false,
    ...overrides,
  };
};
