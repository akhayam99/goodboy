import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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
  it('reports an exception thrown by the site', () => {
    const message = exception({ url: 'http://127.0.0.1:1499/assets/main.js' });
    assert.equal(readPageError({ message }), 'TypeError: boom');
  });

  it('reports a console error from the site', () => {
    const message = consoleError({ url: 'http://localhost:1499/assets/main.js' });
    assert.equal(readPageError({ message }), 'failed');
  });

  it('reports an error with no source', () => {
    assert.equal(readPageError({ message: exception({}) }), 'TypeError: boom');
  });

  it('ignores errors from a third-party script', () => {
    const url = 'https://cdn.iubenda.com/cs/iubenda_cs.js';
    assert.equal(readPageError({ message: exception({ url }) }), null);
    assert.equal(readPageError({ message: consoleError({ url }) }), null);
  });

  it('ignores a host that only starts like the site', () => {
    const url = 'https://localhost.example.com/a.js';
    assert.equal(readPageError({ message: exception({ url }) }), null);
  });

  it('ignores other events', () => {
    assert.equal(readPageError({ message: { method: 'Page.loadEventFired' } }), null);
  });
});
