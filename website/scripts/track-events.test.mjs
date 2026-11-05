import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isCountedClick } from '../src/lib/isCountedClick.ts';
import { readTrackEvent } from '../src/lib/readTrackEvent.ts';
import { trackAttributes } from '../src/lib/trackAttributes.ts';
import { versionOfUrl } from '../src/lib/versionOfUrl.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC = JSON.parse(readFileSync(join(HERE, '..', 'src', 'lib', 'trackEvents.json'), 'utf8'));

const read = (attributes) => readTrackEvent({ attributes, spec: SPEC });

describe('the event spec', () => {
  it('holds the four action events and no menu event', () => {
    assert.deepEqual(Object.keys(SPEC).sort(), [
      'copy_install_command',
      'demo_click',
      'download_click',
      'star_click',
    ]);
  });

  it('names every event and parameter in snake_case', () => {
    Object.entries(SPEC).forEach(([event, params]) => {
      assert.match(event, /^[a-z]+(_[a-z]+)*$/);
      Object.keys(params).forEach((name) => assert.match(name, /^[a-z]+(_[a-z]+)*$/));
    });
  });
});

describe('trackAttributes', () => {
  it('writes the event and one kebab-case attribute per parameter', () => {
    assert.deepEqual(
      trackAttributes({ event: 'star_click', params: { cta_location: 'nav_sheet' } }),
      { 'data-track': 'star_click', 'data-track-cta-location': 'nav_sheet' },
    );
  });
});

describe('readTrackEvent', () => {
  const download = {
    'data-track': 'download_click',
    'data-track-platform': 'linux',
    'data-track-package': 'appimage',
    'data-track-cta-location': 'hero',
    'data-track-app-version': '0.31.10',
  };

  it('reads a listed event with its parameters back to snake_case', () => {
    assert.deepEqual(read(download), {
      event: 'download_click',
      params: {
        platform: 'linux',
        package: 'appimage',
        cta_location: 'hero',
        app_version: '0.31.10',
      },
    });
  });

  it('round-trips what trackAttributes writes', () => {
    const attributes = trackAttributes({
      event: 'copy_install_command',
      params: { install_method: 'brew' },
    });
    assert.deepEqual(read(attributes), {
      event: 'copy_install_command',
      params: { install_method: 'brew' },
    });
  });

  it('drops an event that is not listed, including an inherited name', () => {
    assert.equal(read({ 'data-track': 'menu_click' }), null);
    assert.equal(read({ 'data-track': 'constructor' }), null);
    assert.equal(read({ 'data-track': '__proto__' }), null);
    assert.equal(read({}), null);
  });

  it('drops a missing, unlisted or extra parameter', () => {
    assert.equal(read({ ...download, 'data-track-package': 'exe' }), null);
    assert.equal(read({ ...download, 'data-track-app-version': 'latest' }), null);
    assert.equal(read({ ...download, 'data-track-text': 'Download for macOS' }), null);
    const { 'data-track-platform': omitted, ...missing } = download;
    assert.equal(omitted, 'linux');
    assert.equal(read(missing), null);
  });
});

describe('app_version', () => {
  const download = {
    'data-track': 'download_click',
    'data-track-platform': 'macos',
    'data-track-package': 'dmg',
    'data-track-cta-location': 'hero',
  };

  it('accepts a release and a pre-release and rejects other text', () => {
    ['0.31.10', '0.41.0-rc.1', '1.0.0-beta'].forEach((version) => {
      assert.equal(
        read({ ...download, 'data-track-app-version': version })?.event,
        'download_click',
      );
    });
    ['latest', '0.41', '0.41.0-', '0.41.0 rc'].forEach((version) => {
      assert.equal(read({ ...download, 'data-track-app-version': version }), null, version);
    });
  });
});

describe('isCountedClick', () => {
  it('counts the primary and the middle button and rejects every other', () => {
    assert.equal(isCountedClick({ button: 0 }), true);
    assert.equal(isCountedClick({ button: 1 }), true);
    assert.equal(isCountedClick({ button: 2 }), false);
    assert.equal(isCountedClick({ button: 3 }), false);
    assert.equal(isCountedClick({ button: 4 }), false);
  });

  it('is applied to every click and auxclick in the listener', () => {
    const source = readFileSync(join(HERE, '..', 'src', 'lib', 'startTracking.ts'), 'utf8');
    assert.match(source, /isCountedClick\(\{ button: event\.button \}\)/);
  });
});

describe('the downloaded version', () => {
  const assetUrl = (version) =>
    `https://github.com/akhayam99/goodboy/releases/download/v${version}/Goodboy_${version}_universal.dmg`;

  it('reads the version out of an asset url', () => {
    assert.equal(versionOfUrl({ url: assetUrl('0.31.10') }), '0.31.10');
    assert.equal(versionOfUrl({ url: assetUrl('0.41.0-rc.1') }), '0.41.0-rc.1');
    assert.equal(versionOfUrl({ url: 'https://example.test/Goodboy.dmg' }), null);
  });

  it('writes the version it is given, not the build version', () => {
    const source = readFileSync(join(HERE, '..', 'src', 'lib', 'downloadTrack.ts'), 'utf8');
    assert.ok(!source.includes('LATEST_VERSION'));
    assert.match(source, /app_version: version/);
    const attributes = trackAttributes({
      event: 'download_click',
      params: {
        platform: 'macos',
        package: 'dmg',
        cta_location: 'hero',
        app_version: versionOfUrl({ url: assetUrl('0.31.10') }),
      },
    });
    assert.equal(read(attributes)?.params.app_version, '0.31.10');
  });

  it('is passed by every call site', () => {
    ['Hero.tsx', 'Install.tsx'].forEach((name) => {
      const source = readFileSync(
        join(HERE, '..', 'src', 'pages', 'home', 'sections', name),
        'utf8',
      );
      const calls = source.split('downloadTrack({').length - 1;
      const versions = source.match(/version: (primary|versions)\./g)?.length ?? 0;
      assert.ok(calls > 0);
      assert.equal(versions, calls, name);
    });
  });
});
