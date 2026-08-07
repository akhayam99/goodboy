import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentPlatform } from './index';

const stubUserAgent = (ua: string): void => {
  vi.stubGlobal('navigator', { userAgent: ua });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('currentPlatform', () => {
  it('reads darwin from a real macOS webview user agent', () => {
    stubUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    );

    expect(currentPlatform()).toBe('darwin');
  });

  it('reads linux from a real webkitgtk user agent', () => {
    stubUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    );

    expect(currentPlatform()).toBe('linux');
  });

  it('reads win32 from a real windows webview user agent', () => {
    stubUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    expect(currentPlatform()).toBe('win32');
  });

  it('falls back to linux when there is no navigator to read', () => {
    vi.stubGlobal('navigator', undefined);

    expect(currentPlatform()).toBe('linux');
  });

  it('never reads darwin from the ambient test-runner user agent, even on a mac', () => {
    expect(navigator.userAgent.toLowerCase().includes('mac')).toBe(false);
    expect(currentPlatform()).not.toBe('darwin');
  });
});
