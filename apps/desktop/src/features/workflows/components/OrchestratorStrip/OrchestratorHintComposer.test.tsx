// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OrchestratorHintDraft } from '../../../../store/slices/workflows/addWorkflowOrchestratorHint';
import { OrchestratorHintComposer } from './OrchestratorHintComposer';

afterEach(cleanup);

type MountParams = {
  readonly isSaved?: boolean;
};

const mount = ({ isSaved = true }: MountParams = {}) => {
  const drafts: OrchestratorHintDraft[] = [];
  render(
    <OrchestratorHintComposer
      isDeciding={false}
      isStepRunning
      onSubmit={async (draft) => {
        drafts.push(draft);
        return isSaved;
      }}
    />,
  );
  return drafts;
};

const field = () => screen.getByRole('textbox', { name: 'Hint for the orchestrator' });

const MULTI_LINE = 'Acme wants a shorter wait.\n- cap the backoff at **2 s**\n- log each retry';

const pasteImage = async (name: string) => {
  fireEvent.paste(field(), {
    clipboardData: { files: [new File(['ABC'], name, { type: 'image/png' })] },
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('OrchestratorHintComposer', () => {
  it('takes several lines on Shift+Enter and queues them on Enter', async () => {
    const drafts = mount();
    fireEvent.change(field(), { target: { value: MULTI_LINE } });
    const isNewLineKept = fireEvent.keyDown(field(), { key: 'Enter', shiftKey: true });
    expect(isNewLineKept).toBe(true);
    expect(drafts).toEqual([]);

    fireEvent.keyDown(field(), { key: 'Enter' });
    await waitFor(() => expect(drafts).toEqual([{ text: MULTI_LINE, delivery: 'queue' }]));
    expect(field()).toHaveProperty('value', '');
  });

  it('reads the hint now on Cmd+Enter', async () => {
    const drafts = mount();
    fireEvent.change(field(), { target: { value: 'skip the visual suite' } });
    fireEvent.keyDown(field(), { key: 'Enter', metaKey: true });
    await waitFor(() =>
      expect(drafts).toEqual([{ text: 'skip the visual suite', delivery: 'now' }]),
    );
  });

  it('sends a pasted image with the hint and says where images go', async () => {
    const drafts = mount();
    fireEvent.focus(field());
    expect(screen.getByText('Files go to the next agent')).toBeDefined();
    fireEvent.change(field(), { target: { value: 'the trace is attached' } });
    await pasteImage('checkout-trace.png');
    expect(screen.getByRole('button', { name: 'Remove checkout-trace.png' })).toBeDefined();

    fireEvent.click(screen.getByTestId('orchestrator-hint-queue'));
    await waitFor(() => expect(drafts).toHaveLength(1));
    expect(drafts[0]?.attachments?.map((input) => [input.fileName, input.dataBase64])).toEqual([
      ['checkout-trace.png', 'QUJD'],
    ]);
    expect(screen.queryByRole('button', { name: 'Remove checkout-trace.png' })).toBeNull();
  });

  it('puts the text and the image back when the hint could not be saved', async () => {
    const drafts = mount({ isSaved: false });
    fireEvent.change(field(), { target: { value: MULTI_LINE } });
    await pasteImage('checkout-trace.png');

    fireEvent.click(screen.getByTestId('orchestrator-hint-now'));
    await waitFor(() => expect(drafts).toHaveLength(1));
    await waitFor(() => expect(field()).toHaveProperty('value', MULTI_LINE));
    expect(screen.getByRole('button', { name: 'Remove checkout-trace.png' })).toBeDefined();
  });

  it('previews the hint as markdown', async () => {
    mount();
    fireEvent.change(field(), { target: { value: MULTI_LINE } });
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    const preview = await screen.findByTestId('prompt-preview');
    expect(Array.from(preview.querySelectorAll('li')).map((item) => item.textContent)).toEqual([
      'cap the backoff at 2 s',
      'log each retry',
    ]);
  });

  describe('at rest', () => {
    const form = () => screen.getByRole('form', { name: 'Tell the orchestrator' });

    it('is one text row with no tabs, no key hints and no buttons until it is used', () => {
      mount();

      expect(form().getAttribute('data-open')).toBe('false');
      expect(field().getAttribute('rows')).toBe('1');
      expect(screen.queryByRole('tab', { name: 'Preview' })).toBeNull();
      expect(screen.queryByTestId('orchestrator-hint-queue')).toBeNull();
      expect(screen.queryByTestId('orchestrator-hint-now')).toBeNull();
      expect(screen.queryByText('Files go to the next agent')).toBeNull();
      expect(screen.getByRole('button', { name: 'Attach files' })).toBeDefined();
    });

    it('opens on focus with the tabs, the hints and both buttons, and two rows', () => {
      mount();

      fireEvent.focus(field());

      expect(form().getAttribute('data-open')).toBe('true');
      expect(field().getAttribute('rows')).toBe('2');
      expect(screen.getByRole('tab', { name: 'Preview' })).toBeDefined();
      expect(screen.getByTestId('orchestrator-hint-queue')).toBeDefined();
      expect(screen.getByTestId('orchestrator-hint-now')).toBeDefined();
    });

    it('closes again when focus leaves an empty field', () => {
      mount();

      fireEvent.focus(field());
      fireEvent.blur(field(), { relatedTarget: document.body });

      expect(form().getAttribute('data-open')).toBe('false');
    });

    it('stays open while it holds text, even without focus', () => {
      mount();

      fireEvent.change(field(), { target: { value: 'skip the visual suite' } });
      fireEvent.blur(field(), { relatedTarget: document.body });

      expect(form().getAttribute('data-open')).toBe('true');
      expect(screen.getByTestId('orchestrator-hint-queue')).toBeDefined();
    });

    it('stays open while focus moves to its own buttons', () => {
      mount();
      fireEvent.focus(field());

      fireEvent.blur(field(), { relatedTarget: screen.getByRole('tab', { name: 'Preview' }) });

      expect(form().getAttribute('data-open')).toBe('true');
    });

    it('returns to the write view when it closes from the preview tab', async () => {
      mount();
      fireEvent.focus(field());
      fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
      await screen.findByTestId('prompt-preview');

      fireEvent.blur(screen.getByRole('tab', { name: 'Write' }), { relatedTarget: document.body });

      expect(screen.queryByTestId('prompt-preview')).toBeNull();
      expect(field()).toBeDefined();
    });
  });
});
