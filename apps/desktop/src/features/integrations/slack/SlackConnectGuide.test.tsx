// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { openUrl } = vi.hoisted(() => ({ openUrl: vi.fn(async () => undefined) }));

vi.mock('../../../shared/lib/editor', () => ({ openUrl }));

import { SlackConnectGuide } from './SlackConnectGuide';
import { buildSlackManifestUrl, SLACK_USER_SCOPES } from './slackAppManifest';

const MANIFEST_URL = buildSlackManifestUrl({ userScopes: SLACK_USER_SCOPES });

const writeText = vi.fn(async () => undefined);

beforeEach(() => {
  openUrl.mockClear();
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});
afterEach(cleanup);

describe('SlackConnectGuide', () => {
  it('shows one step at a time, leading with the action that carries the scopes into Slack', () => {
    render(<SlackConnectGuide manifestUrl={MANIFEST_URL} />);
    expect(screen.getByText('Step 1 of 3')).toBeDefined();
    expect(screen.queryByText(/Copy the User OAuth Token/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /open Slack with the scopes filled in/i }));
    expect(openUrl).toHaveBeenCalledWith(MANIFEST_URL);
  });

  it('walks forward and back through the steps', () => {
    render(<SlackConnectGuide manifestUrl={MANIFEST_URL} />);
    const back = screen.getByRole('button', { name: /back/i }) as HTMLButtonElement;
    expect(back.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/Install the app in your workspace/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/Copy the User OAuth Token/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /next/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(/Install the app in your workspace/i)).toBeDefined();
  });

  it('names every scope on the scope step and hands the exact list to the clipboard', async () => {
    render(<SlackConnectGuide manifestUrl={null} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    SLACK_USER_SCOPES.forEach((scope) => expect(screen.getByText(scope)).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Slack scopes' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'channels:read\nchannels:history\nusers:read\nchat:write\nreactions:write',
      ),
    );
  });

  it('sends the owner of an existing app to that app instead of a second one', () => {
    render(<SlackConnectGuide manifestUrl={MANIFEST_URL} />);
    fireEvent.click(screen.getByRole('tab', { name: /existing app/i }));
    expect(screen.getByText('Step 1 of 4')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /open your Slack apps/i }));
    expect(openUrl).toHaveBeenCalledWith('https://api.slack.com/apps');
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/add these five User Token Scopes/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/Reinstall the app/i)).toBeDefined();
  });

  it('restarts from the first step when the path changes', () => {
    render(<SlackConnectGuide manifestUrl={MANIFEST_URL} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('tab', { name: /existing app/i }));
    expect(screen.getByText('Step 1 of 4')).toBeDefined();
  });

  it('falls back to the manual steps when the manifest url is unavailable', () => {
    render(<SlackConnectGuide manifestUrl={null} />);
    expect(screen.queryByRole('button', { name: /scopes filled in/i })).toBeNull();
    expect(screen.getByText('Step 1 of 4')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /open Slack app creation/i }));
    expect(openUrl).toHaveBeenCalledWith('https://api.slack.com/apps/new');
  });
});
