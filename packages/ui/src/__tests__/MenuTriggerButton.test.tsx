// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MenuTriggerButton } from '../components/MenuTriggerButton';

afterEach(cleanup);

const trigger = (): HTMLElement => screen.getByRole('button', { name: 'Branch actions' });

describe('MenuTriggerButton', () => {
  it('is the 24px compact square by default, the size of a list row icon button', () => {
    render(
      <MenuTriggerButton label="Branch actions" isOpen={false} onClick={vi.fn()}>
        <svg />
      </MenuTriggerButton>,
    );

    expect(trigger().getAttribute('data-size')).toBe('compact');
    const classes = trigger().className.split(' ');
    expect(classes).toEqual(
      expect.arrayContaining(['inline-flex', 'size-6', 'items-center', 'justify-center']),
    );
    expect(classes).not.toContain('size-7');
    expect(classes).not.toContain('p-1');
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
    expect(classes).not.toContain('size-6');
  });

  it('keeps a visible focus ring so the trigger stays reachable by keyboard', () => {
    render(
      <MenuTriggerButton label="Branch actions" isOpen={false} onClick={vi.fn()}>
        <svg />
      </MenuTriggerButton>,
    );

    expect(trigger().className).toContain('focus-visible:ring-2');
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

  it('says More actions on hover while the contextual name stays in aria-label', () => {
    vi.useFakeTimers();
    render(
      <MenuTriggerButton label="Branch actions" isOpen={false} onClick={vi.fn()}>
        <svg />
      </MenuTriggerButton>,
    );

    fireEvent.mouseEnter(trigger());
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByRole('tooltip').textContent).toBe('More actions');
    expect(trigger().getAttribute('aria-label')).toBe('Branch actions');
    vi.useRealTimers();
  });

  it('keeps a caller tooltip over the default', () => {
    vi.useFakeTimers();
    render(
      <MenuTriggerButton
        label="Branch actions"
        tooltip="Plan actions"
        isOpen={false}
        onClick={vi.fn()}
      >
        <svg />
      </MenuTriggerButton>,
    );

    fireEvent.mouseEnter(trigger());
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByRole('tooltip').textContent).toBe('Plan actions');
    vi.useRealTimers();
  });

  it('shows no tooltip over its own open menu', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <MenuTriggerButton label="Branch actions" isOpen={false} onClick={vi.fn()}>
        <svg />
      </MenuTriggerButton>,
    );
    fireEvent.mouseEnter(trigger());
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('tooltip')).toBeDefined();

    rerender(
      <MenuTriggerButton label="Branch actions" isOpen onClick={vi.fn()}>
        <svg />
      </MenuTriggerButton>,
    );
    fireEvent.mouseEnter(trigger());
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.queryByRole('tooltip')).toBeNull();
    vi.useRealTimers();
  });
});
