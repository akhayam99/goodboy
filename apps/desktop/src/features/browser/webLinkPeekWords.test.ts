import { describe, expect, it } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import { webLinkPeekWords } from './webLinkPeekWords';

const SESSION_ID = nextSessionId();

describe('what a plain click on a web link does', () => {
  it('says it opens beside the session, and what a command click does', () => {
    expect(webLinkPeekWords({ sessionId: SESSION_ID, mode: 'goodboy', hasTab: false })).toMatch(
      /^Opens beside the session\. .*-click opens your browser\.$/,
    );
    expect(webLinkPeekWords({ sessionId: SESSION_ID, mode: 'goodboy', hasTab: true })).toMatch(
      /^Shows its tab beside the session\./,
    );
  });

  it('says it opens your browser when the setting sends links there', () => {
    expect(webLinkPeekWords({ sessionId: SESSION_ID, mode: 'browser', hasTab: false })).toBe(
      'Opens your browser.',
    );
  });

  it('names the missing session when a terminal has none', () => {
    expect(webLinkPeekWords({ sessionId: null, mode: 'goodboy', hasTab: false })).toBe(
      'Opens your browser, since no session is here to open it beside.',
    );
  });
});
