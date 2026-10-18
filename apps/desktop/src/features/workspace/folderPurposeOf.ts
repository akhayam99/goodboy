import type { FolderFileKind, FolderPurpose, FolderSignals } from '@goodboy/types';

const DOCUMENT_KINDS: ReadonlyArray<FolderFileKind> = [
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

type Params = {
  readonly signals: FolderSignals;
};

const documentFileCount = ({ signals }: Params): number =>
  DOCUMENT_KINDS.reduce((total, kind) => total + signals.counts[kind], 0);

export const folderPurposeOf = ({ signals }: Params): FolderPurpose | null => {
  if (signals.markers.length > 0) {
    return 'code';
  }
  const source = signals.counts.source;
  const documents = documentFileCount({ signals });
  if (source === documents) {
    return null;
  }
  return source > documents ? 'code' : 'documents';
};
