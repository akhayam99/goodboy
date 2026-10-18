import type {
  FolderCodeMarker,
  FolderFileKind,
  FolderPurpose,
  FolderSignals,
} from '@goodboy/types';
import { formatInteger } from '../../shared/utils/formatInteger';
import { dominantMediaOf } from './dominantMediaOf';

type DocumentKind = Exclude<FolderFileKind, 'source' | 'other'>;

const DOCUMENT_NOUNS = {
  markdown: ['Markdown file', 'Markdown files'],
  text: ['text file', 'text files'],
  pdf: ['PDF', 'PDFs'],
  word: ['Word file', 'Word files'],
  pages: ['Pages file', 'Pages files'],
  keynote: ['Keynote file', 'Keynote files'],
  numbers: ['Numbers file', 'Numbers files'],
  excel: ['Excel file', 'Excel files'],
  powerpoint: ['PowerPoint file', 'PowerPoint files'],
  image: ['image', 'images'],
  video: ['video', 'videos'],
  audio: ['audio file', 'audio files'],
} as const satisfies Record<DocumentKind, readonly [string, string]>;

const DOCUMENT_KINDS: ReadonlyArray<DocumentKind> = [
  'markdown',
  'text',
  'pdf',
  'word',
  'pages',
  'keynote',
  'numbers',
  'excel',
  'powerpoint',
  'image',
  'video',
  'audio',
];

const MARKER_NOUN = {
  'package.json': 'a package.json',
  'Cargo.toml': 'a Cargo.toml',
  'pyproject.toml': 'a pyproject.toml',
  'go.mod': 'a go.mod',
  Gemfile: 'a Gemfile',
  'pom.xml': 'a pom.xml',
  Makefile: 'a Makefile',
  'build.gradle': 'a build.gradle',
  'CMakeLists.txt': 'a CMakeLists.txt',
  'Package.swift': 'a Package.swift',
  'composer.json': 'a composer.json',
  xcode: 'an Xcode project',
} as const satisfies Record<FolderCodeMarker, string>;

type CountParams = {
  readonly count: number;
  readonly nouns: readonly [string, string];
};

const counted = ({ count, nouns }: CountParams): string =>
  `${formatInteger(count)} ${count === 1 ? nouns[0] : nouns[1]}`;

type SignalsParams = {
  readonly signals: FolderSignals;
};

const sourceFiles = ({ signals }: SignalsParams): string =>
  counted({ count: signals.counts.source, nouns: ['source file', 'source files'] });

const documentKindsBySize = ({ signals }: SignalsParams): ReadonlyArray<DocumentKind> =>
  DOCUMENT_KINDS.filter((kind) => signals.counts[kind] > 0).sort(
    (a, b) => signals.counts[b] - signals.counts[a],
  );

const documentFileTotal = ({ signals }: SignalsParams): number =>
  DOCUMENT_KINDS.reduce((total, kind) => total + signals.counts[kind], 0);

const codeLine = ({ signals }: SignalsParams): string => {
  const marker = signals.markers[0];
  if (marker === undefined) {
    return `Looks like code: ${sourceFiles({ signals })}`;
  }
  if (signals.counts.source === 0) {
    return `Looks like code: ${MARKER_NOUN[marker]}`;
  }
  return `Looks like code: ${MARKER_NOUN[marker]} and ${sourceFiles({ signals })}`;
};

const documentsLine = ({ signals }: SignalsParams): string => {
  const media = dominantMediaOf({ signals });
  if (media !== null) {
    return `Looks like documents: ${counted({ count: signals.totalFiles, nouns: ['file', 'files'] })}, most of them ${media}`;
  }
  const [first, second] = documentKindsBySize({ signals });
  if (first === undefined) {
    return `Looks like documents: ${counted({ count: signals.totalFiles, nouns: ['file', 'files'] })}`;
  }
  const lead = counted({ count: signals.counts[first], nouns: DOCUMENT_NOUNS[first] });
  if (second === undefined) {
    return `Looks like documents: ${lead}`;
  }
  return `Looks like documents: ${lead} and ${counted({ count: signals.counts[second], nouns: DOCUMENT_NOUNS[second] })}`;
};

type Params = {
  readonly signals: FolderSignals;
  readonly preselected: FolderPurpose | null;
};

export const folderSignalsLine = ({ signals, preselected }: Params): string => {
  if (signals.totalFiles === 0) {
    return 'This folder is empty';
  }
  if (preselected === 'code') {
    return codeLine({ signals });
  }
  if (preselected === 'documents') {
    return documentsLine({ signals });
  }
  return `Could be either: ${sourceFiles({ signals })} and ${counted({ count: documentFileTotal({ signals }), nouns: ['document', 'documents'] })}`;
};
