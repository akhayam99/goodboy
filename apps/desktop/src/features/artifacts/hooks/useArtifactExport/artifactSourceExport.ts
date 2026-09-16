import type { ArtifactSourceFormat } from '@goodboy/types';

export type ArtifactSourceExport = Readonly<{
  actionLabel: string;
  fileExtension: string;
  filterName: string;
  filterExtensions: ReadonlyArray<string>;
}>;

const MARKDOWN_EXPORT: ArtifactSourceExport = {
  actionLabel: 'Save markdown',
  fileExtension: 'md',
  filterName: 'Markdown',
  filterExtensions: ['md', 'markdown'],
};

const JSON_EXPORT: ArtifactSourceExport = {
  actionLabel: 'Save JSON',
  fileExtension: 'json',
  filterName: 'JSON',
  filterExtensions: ['json'],
};

export const artifactSourceExport = ({
  sourceFormat,
}: {
  readonly sourceFormat: ArtifactSourceFormat;
}): ArtifactSourceExport => (sourceFormat === 'json' ? JSON_EXPORT : MARKDOWN_EXPORT);

export const artifactExportContents = ({
  sourceFormat,
  sourceText,
}: {
  readonly sourceFormat: ArtifactSourceFormat;
  readonly sourceText: string;
}): string => {
  if (sourceFormat !== 'json') {
    return sourceText;
  }
  try {
    return JSON.stringify(JSON.parse(sourceText) as unknown, null, 2);
  } catch {
    return sourceText;
  }
};
