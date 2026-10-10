import {
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileJson,
  FileLock,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from 'lucide-react';

type FileGlyphKind = 'code' | 'data' | 'text' | 'image' | 'sheet' | 'lock' | 'archive' | 'generic';

type Params = {
  readonly name: string;
};

const GLYPHS: Readonly<Record<FileGlyphKind, LucideIcon>> = {
  code: FileCode,
  data: FileJson,
  text: FileText,
  image: FileImage,
  sheet: FileSpreadsheet,
  lock: FileLock,
  archive: FileArchive,
  generic: File,
};

const EXTENSIONS: ReadonlyArray<readonly [FileGlyphKind, ReadonlyArray<string>]> = [
  ['lock', ['lock', 'pem', 'crt', 'p12', 'env']],
  [
    'code',
    [
      'bash',
      'c',
      'cc',
      'cjs',
      'cpp',
      'cs',
      'css',
      'fish',
      'go',
      'gql',
      'graphql',
      'h',
      'hpp',
      'htm',
      'html',
      'java',
      'js',
      'jsx',
      'kt',
      'kts',
      'less',
      'mjs',
      'php',
      'py',
      'rb',
      'rs',
      'sass',
      'scss',
      'sh',
      'sql',
      'svelte',
      'swift',
      'ts',
      'tsx',
      'vue',
      'zsh',
    ],
  ],
  ['data', ['cfg', 'conf', 'ini', 'json', 'jsonl', 'properties', 'toml', 'xml', 'yaml', 'yml']],
  ['sheet', ['csv', 'numbers', 'ods', 'tsv', 'xls', 'xlsx']],
  ['text', ['doc', 'docx', 'log', 'markdown', 'md', 'odt', 'pages', 'pdf', 'rst', 'rtf', 'txt']],
  [
    'image',
    ['avif', 'bmp', 'gif', 'heic', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'tif', 'tiff', 'webp'],
  ],
  ['archive', ['7z', 'bz2', 'dmg', 'gz', 'jar', 'rar', 'tar', 'tgz', 'xz', 'zip']],
];

const KIND_BY_EXTENSION: ReadonlyMap<string, FileGlyphKind> = new Map(
  EXTENSIONS.flatMap(([kind, extensions]) =>
    extensions.map((extension) => [extension, kind] as const),
  ),
);

const CODE_NAMES: ReadonlySet<string> = new Set(['dockerfile', 'gemfile', 'makefile', 'procfile']);

const ENV_FILE = /^\.env(\..+)?$/;

const fileGlyphKindOf = ({ name }: Params): FileGlyphKind => {
  const lower = name.toLowerCase();
  if (ENV_FILE.test(lower)) {
    return 'lock';
  }
  if (CODE_NAMES.has(lower)) {
    return 'code';
  }
  const dot = lower.lastIndexOf('.');
  if (dot < 0) {
    return 'generic';
  }
  return KIND_BY_EXTENSION.get(lower.slice(dot + 1)) ?? 'generic';
};

export const fileGlyphOf = ({ name }: Params): LucideIcon => GLYPHS[fileGlyphKindOf({ name })];
