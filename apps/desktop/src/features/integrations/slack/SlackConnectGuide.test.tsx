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
  it('leads with one action that carries the scopes into Slack', () => {
    render(<SlackConnectGuide manifestUrl={MANIFEST_URL} />);
    fireEvent.click(screen.getByRole('button', { name: /open Slack with the scopes filled in/i }));
    expect(openUrl).toHaveBeenCalledWith(MANIFEST_URL);
    expect(screen.getByText(/Copy the User OAuth Token/i)).toBeDefined();
  });

  it('names every scope and hands the exact list to the clipboard', async () => {
    render(<SlackConnectGuide manifestUrl={MANIFEST_URL} />);
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
    expect(screen.getByText(/Add the scopes below under User Token Scopes/i)).toBeDefined();
    expect(screen.getByText(/Reinstall the app/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /open your Slack apps/i }));
    expect(openUrl).toHaveBeenCalledWith('https://api.slack.com/apps');
  });

  it('falls back to the manual steps when the manifest url is unavailable', () => {
    render(<SlackConnectGuide manifestUrl={null} />);
    expect(screen.queryByRole('button', { name: /scopes filled in/i })).toBeNull();
    expect(screen.getByText(/Add the scopes below under User Token Scopes/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /open Slack app creation/i }));
    expect(openUrl).toHaveBeenCalledWith('https://api.slack.com/apps/new');
  });
});
