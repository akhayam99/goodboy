// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { parseChangelog } from './parseChangelog';
import type { ReleaseEntry } from './parseChangelog';

const ROOT_DIRECTORY = join(__dirname, '..', '..', '..', '..', '..');
const CHANGELOG_PATH = join(ROOT_DIRECTORY, 'CHANGELOG.md');
const CHANGELOG_IMAGES_DIR = join(ROOT_DIRECTORY, 'docs', 'changelog');
const STAGING_DIR_NAME = 'next';
const FILE_NAME_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)-(before|after)-(dark|light)\.webp$/;
const MAX_FILE_BYTES = 120 * 1024;
const MAX_RELEASE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES_PER_RELEASE = 12;
const MAX_HEIGHT_PIXELS = 1600;
const PAIR_RULES_FROM_MINOR = 41;

type Size = { readonly width: number; readonly height: number };

const readWebpSize = ({ path }: { readonly path: string }): Size | null => {
  const data = readFileSync(path);
  const kind = data.toString('ascii', 12, 16);
  if (kind === 'VP8 ') {
    return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
  }
  if (kind === 'VP8L') {
    const bits = data.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8X') {
    return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
  }
  return null;
};

const hasVariant = ({
  files,
  image,
  variant,
}: {
  readonly files: ReadonlyArray<ParsedFile>;
  readonly image: string;
  readonly variant: 'before' | 'after';
}): boolean => files.some((file) => file.image === image && file.variant === variant);

const isPairRuleVersion = ({ versionDir }: { readonly versionDir: string }): boolean => {
  const [major, minor] = versionDir.split('.').map(Number);
  return (major ?? 0) > 0 || (minor ?? 0) >= PAIR_RULES_FROM_MINOR;
};

type ParsedFile = {
  readonly fileName: string;
  readonly image: string;
  readonly variant: 'before' | 'after';
  readonly theme: 'dark' | 'light';
};

const listVersionDirectories = (): ReadonlyArray<string> => {
  let entries;
  try {
    entries = readdirSync(CHANGELOG_IMAGES_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== STAGING_DIR_NAME)
    .map((entry) => entry.name);
};

const listFiles = ({ versionDir }: { readonly versionDir: string }): ReadonlyArray<string> =>
  readdirSync(join(CHANGELOG_IMAGES_DIR, versionDir)).filter((name) => name !== '.DS_Store');

const parseFileName = ({ fileName }: { readonly fileName: string }): ParsedFile | null => {
  const match = FILE_NAME_PATTERN.exec(fileName);
  if (match === null) {
    return null;
  }
  const image = match[1];
  const variant = match[2];
  const theme = match[3];
  if (
    image === undefined ||
    (variant !== 'before' && variant !== 'after') ||
    (theme !== 'dark' && theme !== 'light')
  ) {
    return null;
  }
  return { fileName, image, variant, theme };
};

const referencedImages = ({
  release,
}: {
  readonly release: ReleaseEntry | undefined;
}): {
  readonly byImage: ReadonlyMap<string, 'new' | 'improved'>;
  readonly pinnedThemes: ReadonlyMap<string, 'dark' | 'light'>;
} => {
  const byImage = new Map<string, 'new' | 'improved'>();
  const pinnedThemes = new Map<string, 'dark' | 'light'>();
  if (release === undefined || release.shape !== 'v2') {
    return { byImage, pinnedThemes };
  }
  release.sections.new.forEach((feature) => {
    if (feature.image !== null) {
      byImage.set(feature.image, 'new');
    }
  });
  release.sections.improved.forEach((feature) => {
    if (feature.image !== null) {
      byImage.set(feature.image, 'improved');
    }
  });
  [...release.sections.new, ...release.sections.improved].forEach((feature) => {
    if (feature.image !== null && feature.theme !== null) {
      pinnedThemes.set(feature.image, feature.theme);
    }
  });
  return { byImage, pinnedThemes };
};

describe('docs/changelog image budget', () => {
  const changelog = readFileSync(CHANGELOG_PATH, 'utf8');
  const releases = parseChangelog({ text: changelog });
  const versionDirs = listVersionDirectories();

  it('has no version directory outside a real CHANGELOG.md release', () => {
    const versions = new Set(releases.map((release) => release.version));
    versionDirs.forEach((versionDir) => {
      expect(versions.has(versionDir), `docs/changelog/${versionDir} has no matching release`).toBe(
        true,
      );
    });
  });

  versionDirs.forEach((versionDir) => {
    describe(`docs/changelog/${versionDir}`, () => {
      const release = releases.find((entry) => entry.version === versionDir);
      const { byImage, pinnedThemes } = referencedImages({ release });
      const fileNames = listFiles({ versionDir });
      const parsed = fileNames.map((fileName) => ({
        fileName,
        parsed: parseFileName({ fileName }),
      }));

      it('names every file after the pattern <image>-<before|after>-<dark|light>.webp', () => {
        parsed.forEach(({ fileName, parsed: file }) => {
          expect(file, `unexpected file name "${fileName}"`).not.toBeNull();
        });
      });

      it('has no orphan file: every image is referenced by an image= in this release', () => {
        parsed.forEach(({ fileName, parsed: file }) => {
          if (file === null) {
            return;
          }
          expect(
            byImage.has(file.image),
            `${fileName} has no matching image= in Goodboy v${versionDir}`,
          ).toBe(true);
        });
      });

      it('keeps at most 12 distinct images for the release', () => {
        const distinctImages = new Set(
          parsed.flatMap(({ parsed: file }) => (file === null ? [] : [file.image])),
        );
        expect(distinctImages.size).toBeLessThanOrEqual(MAX_IMAGES_PER_RELEASE);
      });

      it('has a complete dark/light pair for every image and variant it carries', () => {
        const byImageVariant = new Map<string, Set<'dark' | 'light'>>();
        parsed.forEach(({ parsed: file }) => {
          if (file === null || pinnedThemes.has(file.image)) {
            return;
          }
          const key = `${file.image}-${file.variant}`;
          const themes = byImageVariant.get(key) ?? new Set<'dark' | 'light'>();
          themes.add(file.theme);
          byImageVariant.set(key, themes);
        });
        byImageVariant.forEach((themes, key) => {
          expect(themes.has('dark'), `${key} is missing its dark file`).toBe(true);
          expect(themes.has('light'), `${key} is missing its light file`).toBe(true);
        });
      });

      it('keeps only the pinned theme for an image pinned with theme=', () => {
        parsed.forEach(({ fileName, parsed: file }) => {
          if (file === null) {
            return;
          }
          const pinned = pinnedThemes.get(file.image);
          if (pinned === undefined) {
            return;
          }
          expect(file.theme, `${fileName} is never shown: its entry pins theme=${pinned}`).toBe(
            pinned,
          );
        });
      });

      it('never has a before without a matching after', () => {
        const images = new Map<string, Set<'before' | 'after'>>();
        parsed.forEach(({ parsed: file }) => {
          if (file === null) {
            return;
          }
          const variants = images.get(file.image) ?? new Set<'before' | 'after'>();
          variants.add(file.variant);
          images.set(file.image, variants);
        });
        images.forEach((variants, image) => {
          if (variants.has('before')) {
            expect(variants.has('after'), `${image} has a before picture but no after`).toBe(true);
          }
        });
      });

      if (isPairRuleVersion({ versionDir })) {
        it('gives every Improved image a before, and every pair one size', () => {
          const sizes = new Map<string, Size>();
          parsed.forEach(({ fileName, parsed: file }) => {
            if (file === null) {
              return;
            }
            const size = readWebpSize({ path: join(CHANGELOG_IMAGES_DIR, versionDir, fileName) });
            expect(size, `${fileName} is not a readable webp`).not.toBeNull();
            if (size === null) {
              return;
            }
            expect(size.width, `${fileName} is portrait`).toBeGreaterThanOrEqual(size.height);
            expect(
              size.height,
              `${fileName} is taller than ${MAX_HEIGHT_PIXELS}px`,
            ).toBeLessThanOrEqual(MAX_HEIGHT_PIXELS);
            const first = sizes.get(file.image);
            if (first === undefined) {
              sizes.set(file.image, size);
              return;
            }
            expect(
              `${size.width}x${size.height}`,
              `${fileName} differs in size from the other files of ${file.image}`,
            ).toBe(`${first.width}x${first.height}`);
          });
          byImage.forEach((section, image) => {
            const files = parsed.flatMap(({ parsed: file }) => (file === null ? [] : [file]));
            if (section === 'improved' && files.some((file) => file.image === image)) {
              expect(
                hasVariant({ files, image, variant: 'before' }),
                `${image} is Improved, so What's new offers Before: it needs before files`,
              ).toBe(true);
            }
          });
        });
      }

      it('keeps every file at or under 120 KB and the release at or under 2 MB', () => {
        let releaseTotal = 0;
        fileNames.forEach((fileName) => {
          const size = statSync(join(CHANGELOG_IMAGES_DIR, versionDir, fileName)).size;
          releaseTotal += size;
          expect(
            size,
            `${fileName} is ${size} bytes, over the ${MAX_FILE_BYTES} byte cap`,
          ).toBeLessThanOrEqual(MAX_FILE_BYTES);
        });
        expect(
          releaseTotal,
          `Goodboy v${versionDir} carries ${releaseTotal} bytes of pictures, over the ${MAX_RELEASE_BYTES} byte cap`,
        ).toBeLessThanOrEqual(MAX_RELEASE_BYTES);
      });
    });
  });
});

describe('hasVariant', () => {
  const files: ReadonlyArray<ParsedFile> = [
    { fileName: 'board-after-dark.webp', image: 'board', variant: 'after', theme: 'dark' },
    {
      fileName: 'board-before-menu-before-dark.webp',
      image: 'board-before-menu',
      variant: 'before',
      theme: 'dark',
    },
  ];

  it('never takes another image name for this image', () => {
    expect(hasVariant({ files, image: 'board', variant: 'before' })).toBe(false);
    expect(hasVariant({ files, image: 'board', variant: 'after' })).toBe(true);
  });
});
