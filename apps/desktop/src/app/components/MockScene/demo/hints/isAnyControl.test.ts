// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isAnyControl } from './isAnyControl';
import { isOtherControl } from './isOtherControl';

const targetOf = (selector: string): Element => {
  const target = document.querySelector(selector);
  if (target === null) {
    throw new Error(`no ${selector}`);
  }
  return target;
};

beforeEach(() => {
  document.body.innerHTML = `
    <p id="text">Words</p>
    <button type="button" id="plain">Plain</button>
    <button type="button" id="anchored" data-demo-anchor="setup-first-start">
      <span id="label">Start</span>
    </button>
  `;
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the control guards', () => {
  it('blocks every control, an anchored one included', () => {
    expect(isAnyControl({ target: targetOf('#plain') })).toBe(true);
    expect(isAnyControl({ target: targetOf('#anchored') })).toBe(true);
    expect(isAnyControl({ target: targetOf('#label') })).toBe(true);
  });

  it('leaves text alone', () => {
    expect(isAnyControl({ target: targetOf('#text') })).toBe(false);
  });

  it('keeps letting an anchored control through when only other controls are blocked', () => {
    expect(isOtherControl({ target: targetOf('#plain') })).toBe(true);
    expect(isOtherControl({ target: targetOf('#anchored') })).toBe(false);
  });
});
