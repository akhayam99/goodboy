// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { ScribeProposalCreatingScene } from './ScribeProposalCreatingScene';
import { ScribeProposalFailedScene } from './ScribeProposalFailedScene';
import { ScribeProposalTranscriptScene } from './ScribeProposalTranscriptScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('Scribe pull request text scenes', () => {
  it('shows the text in the conversation while the engine pushes and opens the draft', async () => {
    render(
      <ToastProvider>
        <ScribeProposalCreatingScene />
      </ToastProvider>,
    );

    const brief = await screen.findByTestId('scribe-proposal');
    expect(brief.textContent).toContain('Pull request text');
    expect(brief.textContent).toContain('Guard settlement postings against retries');
    expect(brief.textContent).toContain('key each posting by its event id');
    expect(screen.getByText('Creating')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('names the failed action in a notice, keeps the reason behind Details and offers Retry', async () => {
    render(
      <ToastProvider>
        <ScribeProposalFailedScene />
      </ToastProvider>,
    );

    const alert = within(await screen.findByTestId('scribe-proposal')).getByRole('alert');
    expect(alert.textContent).toContain("Couldn't write the pull request text");
    expect(alert.textContent).not.toContain('Permission to harborline');
    fireEvent.click(within(alert).getByRole('button', { name: 'Details' }));
    expect(alert.textContent).toContain(
      "Couldn't push fix/ledger-postings: remote: Permission to harborline/ledger-core.git denied",
    );
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeDefined();
    expect(screen.getByText('Guard settlement postings against retries')).toBeDefined();
  });

  it('says Failed on the card once, with no Done anywhere and no state in the header', async () => {
    render(
      <ToastProvider>
        <ScribeProposalFailedScene />
      </ToastProvider>,
    );

    const card = await screen.findByTestId('scribe-proposal');
    expect(within(card).getByText('Failed')).toBeDefined();
    expect(screen.queryByText('Done')).toBeNull();
    expect(within(screen.getByTestId('agent-header-title-row')).queryByText('Failed')).toBeNull();
  });

  it('draws the same text as a card in the transcript, without the raw blocks', async () => {
    render(
      <ToastProvider>
        <ScribeProposalTranscriptScene />
      </ToastProvider>,
    );

    const card = await screen.findByTestId('scribe-proposal');
    expect(card.textContent).toContain('Pull request text');
    expect(card.textContent).toContain('Guard settlement postings against retries');
    expect(card.textContent).toContain('Failed');
    expect(screen.queryByText('<<pr-title>>', { exact: false })).toBeNull();
  });
});
