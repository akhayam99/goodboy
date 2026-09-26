import type { WireframeDocument } from '@goodboy/core';
import type { ArtifactFolderFile } from '../../artifacts/artifactFile';
import type { WireframeFidelity } from '../wireframeFidelity';
import {
  renderWireframeIndexPage,
  renderWireframeScreenPage,
  screenStateFiles,
  WIREFRAME_CSS_FILE,
} from './renderWireframePages';
import type { WireframeDiffMarks } from './renderWireframeNode';
import { wireframeExportCss } from './wireframeExportCss';
import { WIREFRAME_JSON_FILE } from './wireframeReadme';
import { WIREFRAME_SCREENS_DIR } from './wireframeScreenFile';

type Params = {
  readonly document: WireframeDocument;
  readonly sourceText: string;
  readonly title: string;
  readonly fidelity: WireframeFidelity;
  readonly schemaHref: string;
  readonly subtitle?: string;
  readonly homeHref?: string;
  readonly marks?: ReadonlyMap<string, WireframeDiffMarks>;
};

const specJson = ({
  document,
  sourceText,
  schemaHref,
}: {
  readonly document: WireframeDocument;
  readonly sourceText: string;
  readonly schemaHref: string;
}): string => {
  const parsed = ((): unknown => {
    try {
      return JSON.parse(sourceText) as unknown;
    } catch {
      return null;
    }
  })();
  const source =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : document;
  const rest = Object.fromEntries(Object.entries(source).filter(([key]) => key !== '$schema'));
  return `${JSON.stringify({ $schema: schemaHref, ...rest }, null, 2)}\n`;
};

export const buildWireframeVersionFiles = ({
  document,
  sourceText,
  title,
  fidelity,
  schemaHref,
  subtitle,
  homeHref,
  marks,
}: Params): ReadonlyArray<ArtifactFolderFile> => {
  const screens = document.screens.flatMap((screen) => {
    const screenMarks = marks?.get(screen.id);
    return screenStateFiles({ screen }).map(({ state, file }) => ({
      path: `${WIREFRAME_SCREENS_DIR}/${file}`,
      contents: renderWireframeScreenPage({
        document,
        screen,
        state,
        title,
        ...(screenMarks === undefined ? {} : { marks: screenMarks }),
      }),
    }));
  });
  return [
    {
      path: 'index.html',
      contents: renderWireframeIndexPage({
        document,
        title,
        ...(subtitle === undefined ? {} : { subtitle }),
        ...(homeHref === undefined ? {} : { homeHref }),
      }),
    },
    ...screens,
    {
      path: WIREFRAME_CSS_FILE,
      contents: wireframeExportCss({
        theme: document.theme,
        fidelity,
        variants: document.variants ?? [],
      }),
    },
    { path: WIREFRAME_JSON_FILE, contents: specJson({ document, sourceText, schemaHref }) },
  ];
};
