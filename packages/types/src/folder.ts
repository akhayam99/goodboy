export type FolderPurpose = 'code' | 'documents';

export type FolderCodeMarker =
  | 'package.json'
  | 'Cargo.toml'
  | 'pyproject.toml'
  | 'go.mod'
  | 'Gemfile'
  | 'pom.xml'
  | 'Makefile'
  | 'build.gradle'
  | 'CMakeLists.txt'
  | 'Package.swift'
  | 'composer.json'
  | 'xcode';

export type FolderFileKind =
  | 'markdown'
  | 'text'
  | 'pdf'
  | 'word'
  | 'pages'
  | 'keynote'
  | 'numbers'
  | 'excel'
  | 'powerpoint'
  | 'image'
  | 'video'
  | 'audio'
  | 'source'
  | 'other';

export type FolderSignals = Readonly<{
  path: string;
  markers: ReadonlyArray<FolderCodeMarker>;
  counts: Readonly<Record<FolderFileKind, number>>;
  totalFiles: number;
  totalBytes: number;
  entriesRead: number;
  isTruncated: boolean;
}>;

export type FolderSignalsErrorKind =
  'invalid_path' | 'not_found' | 'not_a_directory' | 'permission_denied' | 'io';
