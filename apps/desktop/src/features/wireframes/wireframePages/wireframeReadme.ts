import type { WireframeDocument } from '@goodboy/core';
import { WIREFRAME_SCREENS_DIR, wireframeScreenFile } from './wireframeScreenFile';

export const WIREFRAME_JSON_FILE = 'wireframe.json';

export const WIREFRAME_SCHEMA_FILE = 'wireframe.schema.json';

type Params = {
  readonly title: string;
  readonly document: WireframeDocument;
};

export const wireframeReadme = ({ title, document }: Params): string => {
  const screens = document.screens.map(
    (screen) =>
      `- \`${WIREFRAME_SCREENS_DIR}/${wireframeScreenFile({ screenId: screen.id })}\`: ${screen.title} (${screen.viewport})`,
  );
  const mockKeys = Object.keys(document.mockState ?? {});
  const mockState =
    mockKeys.length === 0
      ? ['The document has no mock state.']
      : [
          'The pages show the default state. These toggles live in `mockState` in the JSON:',
          '',
          ...mockKeys.map(
            (key) =>
              `- \`${key}\`: ${document.mockState?.[key] === true ? 'on' : 'off'} by default`,
          ),
        ];
  return [
    `# ${title}`,
    '',
    'A wireframe exported from Goodboy. Open `index.html` in any browser: it lists the flow between screens and links to a page per screen. The pages hold no script, and every link is a plain link.',
    '',
    '## Files',
    '',
    '- `index.html`: the flow and the screens as a grid',
    ...screens,
    '- `wireframe.css`: the one stylesheet every page uses',
    `- \`${WIREFRAME_JSON_FILE}\`: the validated wireframe document`,
    `- \`${WIREFRAME_SCHEMA_FILE}\`: the JSON Schema that document follows`,
    '- `meta.json`: the id, title and revision of the wireframe in Goodboy',
    '',
    '## Mock state',
    '',
    ...mockState,
    '',
    '## Rebuild it elsewhere',
    '',
    `\`${WIREFRAME_JSON_FILE}\` is the source of truth. Each screen has a root node, nodes nest through \`children\`, and \`transitions\` link a node to the screen it opens. \`${WIREFRAME_SCHEMA_FILE}\` lists every node kind, field and limit.`,
    '',
    'A prompt to hand the folder to a coding agent:',
    '',
    '```text',
    `Build the screens described in ${WIREFRAME_JSON_FILE}, one route per screen, with the components of this codebase.`,
    `Read ${WIREFRAME_SCHEMA_FILE} for what each node kind means. Keep the screen ids as route names,`,
    'wire every transition and navigate action as navigation, and treat mockState keys as local UI state.',
    'Use index.html and the pages in screens/ only as a visual reference.',
    '```',
    '',
  ].join('\n');
};
