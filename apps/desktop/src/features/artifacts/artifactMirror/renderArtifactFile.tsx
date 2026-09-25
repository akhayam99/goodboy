import { renderToStaticMarkup } from 'react-dom/server';
import type { SessionArtifact } from '@goodboy/types';
import { ArtifactDocument } from '../components/ArtifactDocument';
import documentSheet from '../components/ArtifactDocument/artifactDocument.css?raw';
import appStyles from '../../../styles.css?raw';
import { escapeHtml } from '../../wireframes/wireframeExport/escapeHtml';
import { documentTokens } from './documentTokens';

export const ARTIFACT_DOCUMENT_CSS_FILE = 'document.css';

const FILE_RULES = [
  'body { margin: 0; background: var(--color-muted); }',
  ".print-sheet[data-medium='file'] { margin: 0 auto; }",
  '',
].join('\n');

export const artifactDocumentCss = (): string =>
  [documentTokens({ styles: appStyles }), documentSheet, FILE_RULES].join('\n');

export const renderArtifactFile = ({ artifact }: { readonly artifact: SessionArtifact }): string =>
  [
    '<!doctype html>',
    '<html lang="en" data-theme="light">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(artifact.title)}</title>`,
    `<link rel="stylesheet" href="${ARTIFACT_DOCUMENT_CSS_FILE}">`,
    '</head>',
    '<body>',
    `<div class="print-sheet" data-medium="file" data-page="portrait">${renderToStaticMarkup(
      <ArtifactDocument artifact={artifact} medium="file" />,
    )}</div>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
