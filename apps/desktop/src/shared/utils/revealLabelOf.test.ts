// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { revealLabelOf } from './revealLabelOf';

type Params = {
  readonly userAgent: string;
};

const stubUserAgent = ({ userAgent }: Params): void => {
  vi.stubGlobal('navigator', { userAgent });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('revealLabelOf', () => {
  it('says Show in Finder on macOS', () => {
    stubUserAgent({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });

    expect(revealLabelOf()).toBe('Show in Finder');
  });

  it('says Show in folder on Linux, where there is no Finder', () => {
    stubUserAgent({
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });

    expect(revealLabelOf()).toBe('Show in folder');
  });

  it('names the target in the label of a row', () => {
    stubUserAgent({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' });
    expect(revealLabelOf({ target: 'ledger-core' })).toBe('Show ledger-core in Finder');

    stubUserAgent({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' });
    expect(revealLabelOf({ target: 'ledger-core' })).toBe('Show ledger-core in its folder');
  });
});
