// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { driveInboxLink, isInboxLinkRequest } from './driveInboxLink';

afterEach(() => {
  document.body.innerHTML = '';
});

const mountPicker = (isExpanded: boolean, onClick: () => void): HTMLElement => {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<button role="combobox" aria-label="Link to a session" aria-expanded="${isExpanded}" id="picker"></button>`,
  );
  const picker = document.getElementById('picker') as HTMLElement;
  picker.addEventListener('click', () => {
    onClick();
    picker.setAttribute('aria-expanded', String(picker.getAttribute('aria-expanded') !== 'true'));
  });
  return picker;
};

describe('driveInboxLink', () => {
  it('only reacts to the open request', () => {
    expect(isInboxLinkRequest('open')).toBe(true);
    expect(isInboxLinkRequest('closed')).toBe(false);
    expect(isInboxLinkRequest(null)).toBe(false);
  });

  it('opens the picker once it shows up', async () => {
    const onClick = vi.fn();
    const stop = driveInboxLink();

    mountPicker(false, onClick);

    await vi.waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
    stop();
  });

  it('leaves a picker that is already expanded alone', () => {
    const onClick = vi.fn();
    mountPicker(true, onClick);

    driveInboxLink()();

    expect(onClick).not.toHaveBeenCalled();
  });

  it('opens it once across a strict mode double run', () => {
    const onClick = vi.fn();
    mountPicker(false, onClick);

    driveInboxLink()();
    driveInboxLink()();

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
