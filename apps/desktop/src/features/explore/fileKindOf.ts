export type ExploreFileKind = 'text' | 'image' | 'pdf' | 'binary';

type Params = {
  readonly name: string;
};

const IMAGE_EXTENSIONS = new Set([
  'bmp',
  'gif',
  'heic',
  'ico',
  'jpeg',
  'jpg',
  'png',
  'tif',
  'tiff',
  'webp',
]);

const BINARY_EXTENSIONS = new Set([
  '7z',
  'aac',
  'app',
  'avi',
  'bin',
  'dmg',
  'doc',
  'docx',
  'exe',
  'flac',
  'gz',
  'jar',
  'key',
  'mkv',
  'mov',
  'mp3',
  'mp4',
  'numbers',
  'ods',
  'odt',
  'otf',
  'pages',
  'ppt',
  'pptx',
  'psd',
  'sketch',
  'sqlite',
  'tar',
  'ttf',
  'wav',
  'webm',
  'woff',
  'woff2',
  'xls',
  'xlsx',
  'zip',
]);

export const fileKindOf = ({ name }: Params): ExploreFileKind => {
  const dot = name.lastIndexOf('.');
  if (dot < 0) {
    return 'text';
  }
  const extension = name.slice(dot + 1).toLowerCase();
  if (extension === 'pdf') {
    return 'pdf';
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }
  if (BINARY_EXTENSIONS.has(extension)) {
    return 'binary';
  }
  return 'text';
};
