import type { WireframeDocument } from '@goodboy/core';
import { screenStateFiles } from './renderWireframePages';
import { WIREFRAME_SCREENS_DIR } from './wireframeScreenFile';

export const WIREFRAME_JSON_FILE = 'wireframe.json';

export const WIREFRAME_SCHEMA_FILE = 'wireframe.schema.json';

type Params = {
  readonly title: string;
  readonly document: WireframeDocument;
  readonly hasVersions: boolean;
};

export const wireframeReadme = ({ title, document, hasVersions }: Params): string => {
  const base = hasVersions ? 'vN/' : '';
  const screens = document.screens.flatMap((screen) =>
    screenStateFiles({ screen }).map(
      ({ state, file }) =>
        `- \`${base}${WIREFRAME_SCREENS_DIR}/${file}\`: ${screen.title}${state === null ? '' : `, ${screen.states?.[state]?.label ?? state}`} (${screen.viewport})`,
    ),
  );
  const layout = hasVersions
    ? [
        '- `index.html`: every version, newest first, with what was asked for each one',
        '- `vN/`: one folder per version, never pruned. The newest holds:',
      ]
    : [];
  return [
    `# ${title}`,
    '',
    'A wireframe from Goodboy. Open `index.html` in any browser. The pages hold no script and every link is a plain link; the notes sit next to each screen, and each state of a screen has its own page.',
    '',
    '## Files',
    '',
    ...layout,
    `- \`${base}index.html\`: the flow and the screens`,
    ...screens,
    `- \`${base}wireframe.css\`: the one stylesheet every page uses`,
    `- \`${base}${WIREFRAME_JSON_FILE}\`: the spec of that version`,
    `- \`${WIREFRAME_SCHEMA_FILE}\`: the JSON Schema every spec follows`,
    '- `meta.json`: the id, title and revision of the wireframe in Goodboy',
    '',
    '## Change it elsewhere and bring it back',
    '',
    `\`${WIREFRAME_JSON_FILE}\` is the source of truth. \`${WIREFRAME_SCHEMA_FILE}\` lists every node kind, field and limit: patterns you define once and reuse, states per screen, release variants and the device. In Goodboy, Import wireframe JSON turns an edited file into a new version.`,
    '',
    'A prompt to hand the folder to a coding agent:',
    '',
    '```text',
    `Build the screens described in ${WIREFRAME_JSON_FILE}, one route per screen, with the components of this codebase.`,
    `Read ${WIREFRAME_SCHEMA_FILE} for what each node kind means. Keep the screen ids as route names,`,
    'wire every transition and navigate action as navigation, turn each state into the matching',
    'loading, empty or error branch, and build only the nodes of the variant you are asked for.',
    'Use index.html and the pages in screens/ only as a visual reference.',
    '```',
    '',
  ].join('\n');
};
