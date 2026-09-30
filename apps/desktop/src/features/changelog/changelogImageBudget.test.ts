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
const MAX_RELEASE_BYTES = 1024 * 1024;
const MAX_IMAGES_PER_RELEASE = 3;

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
} => {
  const byImage = new Map<string, 'new' | 'improved'>();
  if (release === undefined || release.shape !== 'v2') {
    return { byImage };
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
  return { byImage };
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
      const { byImage } = referencedImages({ release });
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

      it('keeps at most 3 distinct images for the release', () => {
        const distinctImages = new Set(
          parsed.flatMap(({ parsed: file }) => (file === null ? [] : [file.image])),
        );
        expect(distinctImages.size).toBeLessThanOrEqual(MAX_IMAGES_PER_RELEASE);
      });

      it('has a complete dark/light pair for every image and variant it carries', () => {
        const byImageVariant = new Map<string, Set<'dark' | 'light'>>();
        parsed.forEach(({ parsed: file }) => {
          if (file === null) {
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

      it('keeps every file at or under 120 KB and the release at or under 1 MB', () => {
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
