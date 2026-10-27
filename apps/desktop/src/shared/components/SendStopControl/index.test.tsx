// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { shortcutGlyphs } from '../../keyboard/registry';
import { NAMES } from '../../utils/names';
import { SendStopControl } from '.';

afterEach(cleanup);

describe('SendStopControl', () => {
  it('is named Send for a screen reader and sends on click', () => {
    const onSend = vi.fn();
    render(<SendStopControl canSend onSend={onSend} />);

    fireEvent.click(screen.getByRole('button', { name: NAMES.send }));

    expect(onSend).toHaveBeenCalledOnce();
  });

  it('shows the send shortcut from the registry in its tooltip', async () => {
    render(<SendStopControl canSend onSend={() => undefined} />);

    fireEvent.mouseEnter(screen.getByRole('button', { name: NAMES.send }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain(NAMES.send);
    expect(tooltip.textContent).toContain(shortcutGlyphs('composer.send'));
  });

  it('is off, and quiet, when there is nothing to send', () => {
    const onSend = vi.fn();
    render(<SendStopControl canSend={false} onSend={onSend} />);

    const button = screen.getByRole('button', { name: NAMES.send });
    fireEvent.click(button);

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('says why it is off instead of the shortcut', async () => {
    render(
      <SendStopControl canSend={false} disabledReason="Sign in first" onSend={() => undefined} />,
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: NAMES.send }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Sign in first');
    expect(tooltip.textContent).not.toContain(shortcutGlyphs('composer.send'));
  });

  it('keeps the same size in every composer', () => {
    render(<SendStopControl canSend onSend={() => undefined} />);

    expect(screen.getByRole('button', { name: NAMES.send }).getAttribute('data-size')).toBe('sm');
  });

  it('turns into Stop while the answer streams, and stops once', () => {
    const onStop = vi.fn();
    const onSend = vi.fn();
    render(<SendStopControl canSend stop={{ isStopping: false, onStop }} onSend={onSend} />);

    expect(screen.queryByRole('button', { name: NAMES.send })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: NAMES.stop }));

    expect(onStop).toHaveBeenCalledOnce();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('holds Stop while the stop is going through', () => {
    const onStop = vi.fn();
    render(
      <SendStopControl canSend stop={{ isStopping: true, onStop }} onSend={() => undefined} />,
    );

    const button = screen.getByRole('button', { name: NAMES.stopping });
    fireEvent.click(button);

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('button', { name: NAMES.stop })).toBeNull();
    expect(onStop).not.toHaveBeenCalled();
  });

  it('offers Force stop once the stop is stalled, and it asks again', () => {
    const onStop = vi.fn();
    render(
      <SendStopControl
        canSend
        stop={{ isStopping: true, isStalled: true, onStop }}
        onSend={() => undefined}
      />,
    );

    expect(screen.queryByRole('button', { name: NAMES.stop })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: NAMES.forceStop }));

    expect(onStop).toHaveBeenCalledOnce();
  });

  it('shows Esc again to stop only while the first Esc is armed', () => {
    const stop = { isStopping: false, onStop: () => undefined };
    render(<SendStopControl canSend stop={stop} onSend={() => undefined} />);
    expect(screen.queryByText('Esc again to stop')).toBeNull();
    cleanup();
    render(<SendStopControl canSend stop={{ ...stop, isArmed: true }} onSend={() => undefined} />);

    screen.getByText('Esc again to stop');
  });
});
