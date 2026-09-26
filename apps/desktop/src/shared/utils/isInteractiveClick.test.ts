// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { isInteractiveClick } from './isInteractiveClick';

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
});

describe('isInteractiveClick', () => {
  it('treats a click on the body itself as not interactive', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    expect(isInteractiveClick({ target: div })).toBe(false);
  });

  it('treats a click on a link, button, image or input as interactive', () => {
    for (const tag of ['a', 'button', 'img', 'input']) {
      const element = document.createElement(tag);
      document.body.appendChild(element);

      expect(isInteractiveClick({ target: element })).toBe(true);
    }
  });

  it('treats a click on a descendant of an interactive element as interactive', () => {
    const button = document.createElement('button');
    const icon = document.createElement('span');
    button.appendChild(icon);
    document.body.appendChild(button);

    expect(isInteractiveClick({ target: icon })).toBe(true);
  });

  it('treats a click on an element opted out with data-no-edit as interactive', () => {
    const guarded = document.createElement('span');
    guarded.setAttribute('data-no-edit', '');
    document.body.appendChild(guarded);

    expect(isInteractiveClick({ target: guarded })).toBe(true);
  });

  it('treats a click that leaves a non-empty text selection as interactive', () => {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'select me';
    document.body.appendChild(paragraph);

    const range = document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    expect(isInteractiveClick({ target: paragraph })).toBe(true);
  });

  it('treats a click with no target as not interactive', () => {
    expect(isInteractiveClick({ target: null })).toBe(false);
  });
});
