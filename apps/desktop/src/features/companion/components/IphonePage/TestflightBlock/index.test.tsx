// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { storySpies, stubStoryInvoke } from '../../../../../store/storyHarness';
import { TestflightBlock } from '.';

const LINK = 'https://testflight.apple.com/join/Harborline';

beforeEach(() => {
  storySpies.tauriInvoke.mockReset();
  stubStoryInvoke({ bridge_link_qr: () => '<svg data-testid="testflight-qr"></svg>' });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TestflightBlock', () => {
  it('renders nothing and asks for nothing while the link is empty', () => {
    const view = render(<TestflightBlock link="" />);

    expect(view.container.innerHTML).toBe('');
    expect(storySpies.tauriInvoke).not.toHaveBeenCalled();
  });

  it('shows a code made on the Mac, the four steps and Copy link for the public link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<TestflightBlock link={LINK} />);

    expect(await screen.findByTestId('testflight-qr')).toBeTruthy();
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('bridge_link_qr', { link: LINK });
    screen.getByRole('region', { name: 'Get Goodboy for iPhone' });
    screen.getByText("Install TestFlight if you don't have it yet.");
    screen.getByText(LINK);
    fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(LINK));
  });

  it('says so and keeps Copy link when the Mac cannot make the code', async () => {
    stubStoryInvoke({
      bridge_link_qr: () => {
        throw new Error('no code');
      },
    });
    render(<TestflightBlock link={LINK} />);

    expect(await screen.findByText("Couldn't make the code. Copy the link instead.")).toBeTruthy();
    expect(screen.queryByTestId('testflight-qr')).toBeNull();
    screen.getByRole('button', { name: /Copy link/ });
  });

  it('has no email field and makes no network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<TestflightBlock link={LINK} />);
    await screen.findByTestId('testflight-qr');

    expect(document.querySelector('input')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storySpies.tauriInvoke.mock.calls.map(([cmd]) => cmd)).toEqual(['bridge_link_qr']);
  });
});
