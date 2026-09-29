// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { driveInboxLink, isInboxLinkRequest } from './driveInboxLink';

const stubAnimations = (animations: unknown[]): void => {
  Object.defineProperty(document, 'getAnimations', {
    configurable: true,
    value: () => animations,
  });
};

afterEach(() => {
  document.body.innerHTML = '';
  Reflect.deleteProperty(document, 'getAnimations');
});

const mountPicker = (isExpanded: boolean, onClick: () => void): HTMLElement => {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div id="drawer"><button role="combobox" aria-label="Link to a session" aria-expanded="${isExpanded}" id="picker"></button></div>`,
  );
  const picker = document.getElementById('picker') as HTMLElement;
  picker.addEventListener('click', () => {
    onClick();
    picker.setAttribute('aria-expanded', String(picker.getAttribute('aria-expanded') !== 'true'));
  });
  return picker;
};

const enteringAnimation = (target: Element, finished: Promise<unknown>): unknown => ({
  effect: { target, getComputedTiming: () => ({ iterations: 1 }) },
  finished,
});

describe('driveInboxLink', () => {
  it('only reacts to the open request', () => {
    expect(isInboxLinkRequest('open')).toBe(true);
    expect(isInboxLinkRequest('closed')).toBe(false);
    expect(isInboxLinkRequest(null)).toBe(false);
  });

  it('opens the picker once it shows up', async () => {
    stubAnimations([]);
    const onClick = vi.fn();
    const stop = driveInboxLink();

    mountPicker(false, onClick);

    await vi.waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
    stop();
  });

  it('waits for the drawer entrance animation before clicking', async () => {
    let finish: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onClick = vi.fn();
    mountPicker(false, onClick);
    stubAnimations([enteringAnimation(document.getElementById('drawer') as Element, finished)]);

    const stop = driveInboxLink();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onClick).not.toHaveBeenCalled();

    finish();
    await vi.waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
    stop();
  });

  it('ignores animations that do not contain the picker', async () => {
    const other = document.createElement('div');
    document.body.append(other);
    const onClick = vi.fn();
    mountPicker(false, onClick);
    stubAnimations([enteringAnimation(other, new Promise(() => undefined))]);

    const stop = driveInboxLink();

    await vi.waitFor(() => expect(onClick).toHaveBeenCalledTimes(1), { timeout: 300 });
    stop();
  });

  it('falls back to clicking after the timeout when the animation never ends', async () => {
    const onClick = vi.fn();
    mountPicker(false, onClick);
    stubAnimations([
      enteringAnimation(document.getElementById('drawer') as Element, new Promise(() => undefined)),
    ]);

    const stop = driveInboxLink();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(onClick).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(onClick).toHaveBeenCalledTimes(1), { timeout: 1000 });
    stop();
  });

  it('leaves a picker that is already expanded alone', async () => {
    stubAnimations([]);
    const onClick = vi.fn();
    mountPicker(true, onClick);

    const stop = driveInboxLink();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(onClick).not.toHaveBeenCalled();
    stop();
  });

  it('opens it once across a strict mode double run', async () => {
    stubAnimations([]);
    const onClick = vi.fn();
    mountPicker(false, onClick);

    driveInboxLink()();
    const stop = driveInboxLink();

    await vi.waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onClick).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not click after being stopped', async () => {
    stubAnimations([]);
    const onClick = vi.fn();
    mountPicker(false, onClick);

    driveInboxLink()();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(onClick).not.toHaveBeenCalled();
  });
});
