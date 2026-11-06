import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isThirdParty } from './check-page/isThirdParty.mjs';
import { readPageError } from './check-page/readPageError.mjs';

const exception = ({ url, description = 'TypeError: boom' }) => ({
  method: 'Runtime.exceptionThrown',
  params: { exceptionDetails: { url, exception: { description } } },
});

const consoleError = ({ url }) => ({
  method: 'Runtime.consoleAPICalled',
  params: {
    type: 'error',
    args: [{ value: 'failed' }],
    stackTrace: { callFrames: [{ url }] },
  },
});

describe('readPageError', () => {
  it('reads an exception with its source', () => {
    const url = 'http://127.0.0.1:1499/assets/main.js';
    assert.deepEqual(readPageError({ message: exception({ url }) }), {
      url,
      text: 'TypeError: boom',
    });
  });

  it('reads a console error with its source', () => {
    const url = 'http://localhost:1499/assets/main.js';
    assert.deepEqual(readPageError({ message: consoleError({ url }) }), { url, text: 'failed' });
  });

  it('reads an error with no source', () => {
    assert.deepEqual(readPageError({ message: exception({}) }), {
      url: undefined,
      text: 'TypeError: boom',
    });
  });

  it('ignores other events', () => {
    assert.equal(readPageError({ message: { method: 'Page.loadEventFired' } }), null);
  });
});

describe('isThirdParty', () => {
  const pageOrigin = 'https://goodboy-ai.dev';

  it('keeps a source on the checked origin, wherever the site is hosted', () => {
    assert.equal(isThirdParty({ url: `${pageOrigin}/assets/main.js`, pageOrigin }), false);
    assert.equal(
      isThirdParty({ url: 'http://[::1]:1499/a.js', pageOrigin: 'http://[::1]:1499' }),
      false,
    );
  });

  it('keeps an error with no source or a non-http source', () => {
    assert.equal(isThirdParty({ url: undefined, pageOrigin }), false);
    assert.equal(isThirdParty({ url: '', pageOrigin }), false);
    assert.equal(isThirdParty({ url: 'blob:x', pageOrigin }), false);
  });

  it('drops a script from another origin', () => {
    const url = 'https://cdn.iubenda.com/cs/iubenda_cs.js';
    assert.equal(isThirdParty({ url, pageOrigin }), true);
  });

  it('drops a host that only starts like the site', () => {
    const url = 'https://goodboy-ai.dev.example.com/a.js';
    assert.equal(isThirdParty({ url, pageOrigin }), true);
  });
});
