import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize } from './lib/imageSize.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = resolve(ROOT, '..', 'docs', 'features');
const SIZES = resolve(ROOT, 'src', 'prerender', 'imageSizes.json');
const SEO_BASELINE = resolve(ROOT, 'scripts', 'seo-errors.baseline.json');
const MEDIA_URL =
  /https:\/\/raw\.githubusercontent\.com\/akhayam99\/goodboy-media\/main\/([^"\s)]+)/g;

const [mediaRoot] = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
const isCheck = process.argv.includes('--check');

const usedPaths = () =>
  [
    ...new Set(
      readdirSync(DOCS)
        .filter((name) => name.endsWith('.md'))
        .flatMap((name) =>
          [...readFileSync(join(DOCS, name), 'utf8').matchAll(MEDIA_URL)].map((match) => match[1]),
        ),
    ),
  ].sort();

const HEADER_BYTES = 64;

const bytesOf = async ({ path }) => {
  const local = join(mediaRoot, path);
  if (existsSync(local)) {
    return readFileSync(local);
  }
  const response = await fetch(
    `https://raw.githubusercontent.com/akhayam99/goodboy-media/main/${path}`,
    {
      headers: { Range: `bytes=0-${HEADER_BYTES - 1}` },
    },
  );
  if (!response.ok) {
    return null;
  }
  return Buffer.from(await response.arrayBuffer());
};

const main = async () => {
  const used = usedPaths();
  const known = existsSync(SIZES) ? JSON.parse(readFileSync(SIZES, 'utf8')) : {};
  if (mediaRoot === undefined) {
    const baseline = existsSync(SEO_BASELINE) ? JSON.parse(readFileSync(SEO_BASELINE, 'utf8')) : {};
    const missing = used.filter((path) => !Object.hasOwn(known, path));
    const extra = Object.keys(known).filter((path) => !used.includes(path));
    const allowed = Object.values(baseline['img-size'] ?? {}).reduce(
      (total, count) => total + count,
      0,
    );
    if (missing.length > allowed || extra.length > 0) {
      console.error(
        `imageSizes.json is out of date: ${missing.length} missing (${allowed} allowed by the seo baseline), ${extra.length} unused. Run node scripts/sync-image-sizes.mjs <path to the media checkout>`,
      );
      missing.forEach((path) => console.error(`  missing ${path}`));
      extra.forEach((path) => console.error(`  unused ${path}`));
      return 1;
    }
    console.log(`image sizes ok: ${used.length} images`);
    return 0;
  }
  const bytes = await Promise.all(used.map(async (path) => [path, await bytesOf({ path })]));
  bytes
    .filter(([, found]) => found === null)
    .forEach(([path]) => console.warn(`no image at ${path}, left out`));
  const measured = Object.fromEntries(
    bytes
      .filter(([, found]) => found !== null)
      .map(([path, found]) => [path, imageSize({ bytes: found })]),
  );
  if (isCheck) {
    const stale = Object.keys(measured).filter(
      (path) => JSON.stringify(known[path]) !== JSON.stringify(measured[path]),
    );
    console.log(
      stale.length === 0 ? `image sizes ok: ${used.length} images` : `stale: ${stale.join(', ')}`,
    );
    return stale.length === 0 ? 0 : 1;
  }
  writeFileSync(SIZES, `${JSON.stringify(measured, null, 2)}\n`);
  console.log(`wrote ${used.length} image sizes`);
  return 0;
};

process.exit(await main());
