import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { tagsOf } from './lib/seoHtml.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = ['index.html', 'features.html', 'content.html'];

const loaderOf = ({ file }) =>
  tagsOf({ html: readFileSync(join(HERE, '..', file), 'utf8') }).find(
    (tag) => tag.name === 'script' && (tag.body ?? '').includes('GTM_ID'),
  ).body;

const boot = ({ file }) => {
  const inserted = [];
  const timers = [];
  const reloads = [];
  const window = {
    dataLayer: [],
    requestIdleCallback: (callback) => timers.push(callback),
    setTimeout: (callback) => timers.push(callback),
    location: { reload: () => reloads.push('reload') },
  };
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.goodboyConsent = { isMeasurementGranted: false, onPreference: () => {} };
  const document = {
    getElementsByTagName: () => [
      { parentNode: { insertBefore: (script) => inserted.push(script.src) } },
    ],
    createElement: () => ({}),
  };
  vm.runInNewContext(loaderOf({ file }), { window, document });
  const flush = () => timers.splice(0).forEach((callback) => callback());
  return { window, inserted, reloads, flush };
};

const accepted = { purposes: { 4: true } };
const refused = { purposes: { 4: false } };

TEMPLATES.forEach((file) => {
  describe(`consent loader in ${file}`, () => {
    it('installs the handler, so a preference given at once is not lost', () => {
      const { window, inserted, flush } = boot({ file });
      window.goodboyConsent.onPreference(accepted);
      flush();
      assert.equal(inserted.length, 1);
      assert.match(inserted[0], /googletagmanager\.com\/gtm\.js/);
    });

    it('loads nothing for a refusal or no preference, and does not reload', () => {
      const { window, inserted, reloads, flush } = boot({ file });
      window.goodboyConsent.onPreference(refused);
      window.goodboyConsent.onPreference(undefined);
      flush();
      assert.deepEqual([inserted.length, reloads.length], [0, 0]);
    });

    it('reloads once when a visitor withdraws after Tag Manager loaded', () => {
      const { window, inserted, reloads, flush } = boot({ file });
      window.goodboyConsent.onPreference(accepted);
      flush();
      window.goodboyConsent.onPreference(refused);
      flush();
      assert.equal(inserted.length, 1);
      assert.equal(reloads.length, 1);
    });

    it('reloads when the withdrawal comes while gtm.js is still downloading', () => {
      const { window, inserted, reloads, flush } = boot({ file });
      window.goodboyConsent.onPreference(accepted);
      flush();
      assert.equal(inserted.length, 1);
      window.goodboyConsent.onPreference(refused);
      assert.equal(reloads.length, 0);
      flush();
      assert.equal(reloads.length, 1);
    });

    it('does not load when the visitor withdraws before the idle callback runs', () => {
      const { window, inserted, reloads, flush } = boot({ file });
      window.goodboyConsent.onPreference(accepted);
      window.goodboyConsent.onPreference(refused);
      flush();
      assert.deepEqual([inserted.length, reloads.length], [0, 0]);
    });

    it('does not reload again on the page that follows a withdrawal', () => {
      const first = boot({ file });
      first.window.goodboyConsent.onPreference(accepted);
      first.flush();
      first.window.goodboyConsent.onPreference(refused);
      first.flush();
      const next = boot({ file });
      next.window.goodboyConsent.onPreference(refused);
      next.flush();
      assert.equal(next.reloads.length, 0);
    });
  });
});
