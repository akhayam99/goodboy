import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DESKTOP_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..');
const ICONS_DIRECTORY = resolve(DESKTOP_DIRECTORY, 'src-tauri/icons');
const TAURI_BINARY = resolve(DESKTOP_DIRECTORY, 'node_modules/.bin/tauri');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const requireMatch = ({ source, pattern, description }) => {
  const match = source.match(pattern);
  if (match !== null) {
    return match;
  }
  throw new Error(`Could not find ${description}`);
};

const extractCssValue = ({ cssSource, variableName }) =>
  requireMatch({
    source: cssSource,
    pattern: new RegExp(`${variableName}\\s*:\\s*([^;]+);`),
    description: `${variableName} in apps/desktop/src/styles.css`,
  })[1].trim();

const createIconHtml = ({ accent, backgroundColor, mascotBase64 }) => `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box }
  html, body { width: 1024px; height: 1024px; background: transparent; overflow: hidden }
  .backdrop { width: 1024px; height: 1024px; border-radius: 20%; background: ${backgroundColor}; display: grid; place-items: center }
  .mascot { width: 60vh; height: 60vh; background: ${accent}; -webkit-mask: url(data:image/png;base64,${mascotBase64}) no-repeat center / contain }
</style>
<body><div class="backdrop"><i class="mascot"></i></div></body>`;

const renderIconSource = ({ html, outputPath }) => {
  const temporaryHtmlPath = resolve(tmpdir(), `goodboy-icon-source-${process.pid}.html`);
  try {
    writeFileSync(temporaryHtmlPath, html);
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      '--force-device-scale-factor=1',
      '--window-size=1024,1024',
      `--screenshot=${outputPath}`,
      pathToFileURL(temporaryHtmlPath).href,
    ]);
  } finally {
    if (existsSync(temporaryHtmlPath)) {
      unlinkSync(temporaryHtmlPath);
    }
  }
};

const canonicalizeIcnsChunkOrder = ({ filePath }) => {
  const fileBytes = readFileSync(filePath);
  if (fileBytes.toString('ascii', 0, 4) !== 'icns') {
    throw new Error(`${filePath} is not an ICNS file`);
  }
  const totalSize = fileBytes.readUInt32BE(4);
  const chunks = [];
  let offset = 8;
  while (offset < totalSize) {
    const tag = fileBytes.toString('ascii', offset, offset + 4);
    const chunkSize = fileBytes.readUInt32BE(offset + 4);
    chunks.push({ tag, bytes: fileBytes.subarray(offset, offset + chunkSize) });
    offset += chunkSize;
  }
  chunks.sort((left, right) => {
    if (left.tag < right.tag) {
      return -1;
    }
    if (left.tag > right.tag) {
      return 1;
    }
    return 0;
  });
  writeFileSync(
    filePath,
    Buffer.concat([fileBytes.subarray(0, 8), ...chunks.map(({ bytes }) => bytes)]),
  );
};

const fanOutIcons = ({ sourcePath }) => {
  const existingFilenames = readdirSync(ICONS_DIRECTORY).filter(
    (name) => !name.startsWith('.'),
  );
  const temporaryOutputDirectory = mkdtempSync(join(tmpdir(), 'goodboy-icons-'));
  try {
    execFileSync(TAURI_BINARY, ['icon', sourcePath, '-o', temporaryOutputDirectory], {
      cwd: DESKTOP_DIRECTORY,
    });
    existingFilenames.forEach((filename) => {
      const generatedPath = join(temporaryOutputDirectory, filename);
      if (!existsSync(generatedPath)) {
        throw new Error(`tauri icon did not produce ${filename}`);
      }
      copyFileSync(generatedPath, join(ICONS_DIRECTORY, filename));
      if (filename === 'icon.icns') {
        canonicalizeIcnsChunkOrder({ filePath: join(ICONS_DIRECTORY, filename) });
      }
      console.log('updated', join(ICONS_DIRECTORY, filename));
    });
  } finally {
    rmSync(temporaryOutputDirectory, { recursive: true, force: true });
  }
};

const stylesSource = readFileSync(resolve(DESKTOP_DIRECTORY, 'src/styles.css'), 'utf8');
const accent = extractCssValue({ cssSource: stylesSource, variableName: '--color-accent' });

const tauriConfig = JSON.parse(
  readFileSync(resolve(DESKTOP_DIRECTORY, 'src-tauri/tauri.conf.json'), 'utf8'),
);
const backgroundColor = tauriConfig.app.windows[0].backgroundColor;

const mascotBase64 = readFileSync(resolve(DESKTOP_DIRECTORY, 'src/assets/mascot.png')).toString(
  'base64',
);

const html = createIconHtml({ accent, backgroundColor, mascotBase64 });
const sourcePath = resolve(tmpdir(), `goodboy-icon-source-${process.pid}.png`);
try {
  renderIconSource({ html, outputPath: sourcePath });
  fanOutIcons({ sourcePath });
} finally {
  if (existsSync(sourcePath)) {
    unlinkSync(sourcePath);
  }
}
