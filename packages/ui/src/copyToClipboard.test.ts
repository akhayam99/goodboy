// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from './copyToClipboard';

const setClipboard = (writeText: ((text: string) => Promise<void>) | null) => {
  Object.defineProperty(navigator, 'clipboard', {
    value: writeText === null ? undefined : { writeText },
    configurable: true,
  });
};

const setExecCommand = (impl: (() => boolean) | null) => {
  Object.defineProperty(document, 'execCommand', {
    value: impl ?? undefined,
    configurable: true,
    writable: true,
  });
};

afterEach(() => {
  setClipboard(null);
  setExecCommand(null);
});

describe('copyToClipboard', () => {
  it('writes through the async clipboard when it accepts the text', async () => {
    const writeText = vi.fn(async () => undefined);
    const execCommand = vi.fn(() => true);
    setClipboard(writeText);
    setExecCommand(execCommand);

    await copyToClipboard({ text: 'hello' });

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to a selected textarea when the async clipboard refuses, and cleans it up', async () => {
    setClipboard(async () => Promise.reject(new Error('denied')));
    let copied = '';
    setExecCommand(() => {
      copied = document.querySelector('textarea')?.value ?? '';
      return true;
    });

    await copyToClipboard({ text: 'fallback text' });

    expect(copied).toBe('fallback text');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back when the runtime has no async clipboard at all', async () => {
    setClipboard(null);
    const execCommand = vi.fn(() => true);
    setExecCommand(execCommand);

    await copyToClipboard({ text: 'x' });

    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('rejects when both paths fail so the caller can show it', async () => {
    setClipboard(async () => Promise.reject(new Error('denied')));
    setExecCommand(() => false);

    await expect(copyToClipboard({ text: 'x' })).rejects.toThrow('refused');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
