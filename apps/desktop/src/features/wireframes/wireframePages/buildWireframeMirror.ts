import { parseWireframeSource } from '@goodboy/core';
import type { WireframeArtifact } from '@goodboy/types';
import type { ArtifactFolderFile } from '../../artifacts/artifactFile';
import { asWireframeFidelity } from '../wireframeFidelity';
import {
  wireframeVersionFolder,
  wireframeVersionLabel,
  type WireframeVersion,
} from '../wireframeVersion';
import { wireframeSchemaFile } from './buildWireframeExport';
import { buildWireframeVersionFiles } from './buildWireframeVersionFiles';
import { escapeHtml } from './escapeHtml';
import { wireframePage } from './renderWireframePages';
import { WIREFRAME_JSON_FILE, WIREFRAME_SCHEMA_FILE, wireframeReadme } from './wireframeReadme';

type Params = {
  readonly artifact: WireframeArtifact;
  readonly versions: ReadonlyArray<WireframeVersion>;
  readonly workspaceName: string;
};

const currentVersion = ({
  artifact,
}: {
  readonly artifact: WireframeArtifact;
}): WireframeVersion => ({
  revision: artifact.revision,
  title: artifact.title,
  sourceText: artifact.sourceText,
  author: 'agent',
  ask: null,
  createdAt: artifact.updatedAt,
  summary: null,
});

const formatWhen = ({ iso }: { readonly iso: string }): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toISOString().slice(0, 16).replace('T', ' ');
};

const versionsPage = ({
  title,
  workspaceName,
  rows,
}: {
  readonly title: string;
  readonly workspaceName: string;
  readonly rows: ReadonlyArray<Readonly<{ version: WireframeVersion; screens: number | null }>>;
}): string => {
  const [latest] = rows;
  const items = rows
    .map(({ version, screens }) => {
      const folder = wireframeVersionFolder({ revision: version.revision });
      const size = screens === null ? 'not valid, spec only' : `${screens} screens`;
      const target = screens === null ? `${folder}/${WIREFRAME_JSON_FILE}` : `${folder}/index.html`;
      return `<li><a class="wf-tile" href="${escapeHtml(target)}"><span class="wf-tile-title">v${version.revision} ${escapeHtml(wireframeVersionLabel({ version }))}</span><span class="wf-muted">${escapeHtml(formatWhen({ iso: version.createdAt }))} · ${size}</span></a></li>`;
    })
    .join('');
  const current =
    latest === undefined
      ? ''
      : `<span class="wf-muted">v${latest.version.revision} of ${rows.length} · ${escapeHtml(workspaceName)} · Wireframe</span>`;
  const body = [
    `<header class="wf-header"><h1 class="wf-screen-title">${escapeHtml(title)}</h1>${current}</header>`,
    `<section class="wf-links"><h2>Versions</h2><ul>${items}</ul></section>`,
  ].join('');
  const latestFolder =
    latest === undefined ? 'v1' : wireframeVersionFolder({ revision: latest.version.revision });
  return wireframePage({ title, stylesheet: `${latestFolder}/wireframe.css`, body });
};

export const buildWireframeMirror = ({
  artifact,
  versions,
  workspaceName,
}: Params): ReadonlyArray<ArtifactFolderFile> => {
  const fidelity = asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low';
  const known = versions.some((version) => version.revision === artifact.revision)
    ? versions
    : [currentVersion({ artifact }), ...versions];
  const ordered = [...known].sort((left, right) => right.revision - left.revision);
  const rows = ordered.map((version) => {
    const parsed = parseWireframeSource({ source: version.sourceText });
    return { version, parsed };
  });
  const latestValid = rows.find((row) => row.parsed.status === 'valid') ?? null;
  const files = rows.flatMap(({ version, parsed }) => {
    const folder = wireframeVersionFolder({ revision: version.revision });
    if (parsed.status !== 'valid') {
      return [{ path: `${folder}/${WIREFRAME_JSON_FILE}`, contents: `${version.sourceText}\n` }];
    }
    return buildWireframeVersionFiles({
      document: parsed.document,
      sourceText: version.sourceText,
      title: version.title,
      fidelity,
      schemaHref: `../${WIREFRAME_SCHEMA_FILE}`,
      subtitle: `v${version.revision} of ${ordered.length} · ${parsed.document.screens.length} screens`,
      homeHref: '../index.html',
    }).map((file) => ({ path: `${folder}/${file.path}`, contents: file.contents }));
  });
  return [
    {
      path: 'index.html',
      contents: versionsPage({
        title: artifact.title,
        workspaceName,
        rows: rows.map(({ version, parsed }) => ({
          version,
          screens: parsed.status === 'valid' ? parsed.document.screens.length : null,
        })),
      }),
    },
    ...files,
    wireframeSchemaFile(),
    ...(latestValid === null || latestValid.parsed.status !== 'valid'
      ? []
      : [
          {
            path: 'README.md',
            contents: wireframeReadme({
              title: artifact.title,
              document: latestValid.parsed.document,
              hasVersions: true,
            }),
          },
        ]),
  ];
};
