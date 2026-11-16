const RAW_COLOR =
  /(?<![\w&#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|(?<![\w-])(?:rgba?|hsla?|hwb|oklch|oklab|lch|lab)\(/g;

const PRODUCT_ROOTS = ['apps/desktop/src/', 'packages/ui/src/'];

const MOCK_SCENE_PATH = 'apps/desktop/src/app/components/MockScene/';

const countIn = (line) => line.match(RAW_COLOR)?.length ?? 0;

const rawColorLines = ({ file }) =>
  file.path.startsWith(MOCK_SCENE_PATH)
    ? []
    : file.lines.flatMap((line, index) => (countIn(line) > 0 ? [index + 1] : []));

export const RAW_COLOR_RULE = {
  id: 'raw-color',
  kinds: ['ts'],
  roots: PRODUCT_ROOTS,
  ledger: 'own',
  lines: rawColorLines,
  count: (file) =>
    file.path.startsWith(MOCK_SCENE_PATH)
      ? 0
      : file.lines.reduce((total, line) => total + countIn(line), 0),
  hint: 'a colour is a token: read a role (bg-primary-solid, text-muted-foreground) or a var(--color-*) from styles.css, never a hex or an oklch, rgb or hsl literal (packages/ui/DESIGN-SYSTEM.md)',
};
