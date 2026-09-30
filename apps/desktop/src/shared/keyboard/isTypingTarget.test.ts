// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { isTextEntryTarget, isTypingTarget } from './isTypingTarget';

const editable = (): HTMLElement => {
  const element = document.createElement('div');
  Object.defineProperty(element, 'isContentEditable', { value: true });
  return element;
};

describe('isTypingTarget', () => {
  it.each(['input', 'textarea', 'select'])('counts a %s as typing', (tag) => {
    expect(isTypingTarget(document.createElement(tag))).toBe(true);
  });

  it('counts a contentEditable element as typing', () => {
    expect(isTypingTarget(editable())).toBe(true);
  });

  it('does not count buttons, plain elements, the window or null', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('isTextEntryTarget', () => {
  it('counts inputs, textareas and contentEditable but not a select', () => {
    expect(isTextEntryTarget(document.createElement('input'))).toBe(true);
    expect(isTextEntryTarget(document.createElement('textarea'))).toBe(true);
    expect(isTextEntryTarget(editable())).toBe(true);
    expect(isTextEntryTarget(document.createElement('select'))).toBe(false);
  });
});
