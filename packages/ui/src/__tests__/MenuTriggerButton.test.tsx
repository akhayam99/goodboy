// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MenuTriggerButton } from '../components/MenuTriggerButton';

afterEach(cleanup);

const trigger = (): HTMLElement => screen.getByRole('button', { name: 'Branch actions' });

describe('MenuTriggerButton', () => {
  it('is the 21px compact square by default', () => {
    render(
      <MenuTriggerButton label="Branch actions" isOpen={false} onClick={vi.fn()}>
        <svg />
      </MenuTriggerButton>,
    );

    expect(trigger().getAttribute('data-size')).toBe('compact');
    const classes = trigger().className.split(' ');
    expect(classes).toContain('p-1');
    expect(classes).not.toContain('size-7');
  });

  it('is a 28px centred square at the control size, the height of a sm Button', () => {
    render(
      <MenuTriggerButton label="Branch actions" isOpen={false} size="control" onClick={vi.fn()}>
        <svg />
      </MenuTriggerButton>,
    );

    expect(trigger().getAttribute('data-size')).toBe('control');
    const classes = trigger().className.split(' ');
    expect(classes).toEqual(
      expect.arrayContaining(['inline-flex', 'size-7', 'items-center', 'justify-center']),
    );
    expect(classes).not.toContain('p-1');
  });

  it('names the menu it opens and says whether it is open', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <MenuTriggerButton label="Branch actions" isOpen={false} onClick={onClick}>
        <svg />
      </MenuTriggerButton>,
    );
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('title')).toBeNull();

    fireEvent.click(trigger());
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <MenuTriggerButton label="Branch actions" isOpen onClick={onClick}>
        <svg />
      </MenuTriggerButton>,
    );
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().className.split(' ')).toContain('bg-selected');
  });

  it('does not fire while disabled', () => {
    const onClick = vi.fn();
    render(
      <MenuTriggerButton label="Branch actions" isOpen={false} disabled onClick={onClick}>
        <svg />
      </MenuTriggerButton>,
    );

    fireEvent.click(trigger());
    expect(onClick).not.toHaveBeenCalled();
  });
});
