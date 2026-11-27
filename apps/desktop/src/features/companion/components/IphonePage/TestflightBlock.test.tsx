// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const invoke = vi.hoisted(() =>
  vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(),
);

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { TestflightBlock } from './TestflightBlock';

const LINK = 'https://testflight.apple.com/join/Harborline';

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue('<svg data-testid="testflight-qr"></svg>');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TestflightBlock', () => {
  it('renders nothing and asks for nothing while the link is empty', () => {
    const view = render(<TestflightBlock link="" />);

    expect(view.container.innerHTML).toBe('');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('shows a code made on the Mac, the four steps and Copy link for the public link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<TestflightBlock link={LINK} />);

    expect(await screen.findByTestId('testflight-qr')).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith('bridge_link_qr', { link: LINK });
    screen.getByRole('region', { name: 'Get Goodboy for iPhone' });
    screen.getByText('Install TestFlight if you do not have it yet.');
    screen.getByText(LINK);
    fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(LINK));
  });

  it('has no email field and makes no network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<TestflightBlock link={LINK} />);
    await screen.findByTestId('testflight-qr');

    expect(document.querySelector('input')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(invoke.mock.calls.map(([cmd]) => cmd)).toEqual(['bridge_link_qr']);
  });
});
