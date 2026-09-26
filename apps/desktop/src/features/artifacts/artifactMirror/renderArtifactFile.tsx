import { renderToStaticMarkup } from 'react-dom/server';
import type { SessionArtifact } from '@goodboy/types';
import { ArtifactDocument } from '../components/ArtifactDocument';
import documentSheet from '../components/ArtifactDocument/artifactDocument.css?raw';
import appStyles from '../../../styles.css?raw';
import { escapeHtml } from '../../wireframes/wireframePages/escapeHtml';
import { documentTokens } from './documentTokens';
import { INTER_FONT_DATA_URI } from './interFontDataUri';

export const ARTIFACT_DOCUMENT_CSS_FILE = 'document.css';

const FILE_RULES = [
  'body { margin: 0; background: var(--color-muted); }',
  ".print-sheet[data-medium='file'] { margin: 0 auto; }",
  '',
].join('\n');

const BUNDLED_FONT_FACE_RE = /@font-face \{[^}]*InterVariable-latin\.woff2[^}]*\}/;

const fileFontFace = (): string =>
  [
    '@font-face {',
    "  font-family: 'Inter';",
    '  font-style: normal;',
    '  font-weight: 100 900;',
    '  font-display: swap;',
    `  src: url('${INTER_FONT_DATA_URI}') format('woff2-variations');`,
    '}',
  ].join('\n');

export const artifactDocumentCss = (): string =>
  [
    documentTokens({ styles: appStyles }),
    documentSheet.replace(BUNDLED_FONT_FACE_RE, fileFontFace()),
    FILE_RULES,
  ].join('\n');

const CSP = "default-src 'none'; style-src 'self' file:; font-src data:; img-src data:";

type Params = {
  readonly artifact: SessionArtifact;
  readonly workspaceName: string;
};

export const renderArtifactFile = ({ artifact, workspaceName }: Params): string =>
  [
    '<!doctype html>',
    '<html lang="en" data-theme="light">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    `<title>${escapeHtml(artifact.title)}</title>`,
    `<link rel="stylesheet" href="${ARTIFACT_DOCUMENT_CSS_FILE}">`,
    '</head>',
    '<body>',
    `<div class="print-sheet" data-medium="file" data-page="portrait">${renderToStaticMarkup(
      <ArtifactDocument artifact={artifact} medium="file" workspaceName={workspaceName} />,
    )}</div>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
