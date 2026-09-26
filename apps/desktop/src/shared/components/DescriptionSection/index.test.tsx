import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RemoteImageLoaderProvider } from '@goodboy/ui';
import { DescriptionSection } from './index';

const SOURCE = '## Goal\n\nShip the **editor**.';
const FENCED = '```\nplain body, not markdown\n```';
const WITH_LINK = 'Read the [runbook](https://example.com/runbook) first.';
const WITH_IMAGE = '![board](https://example.com/board.png)';

afterEach(cleanup);

describe('DescriptionSection', () => {
  it('renders the prose instead of the markdown source', () => {
    render(<DescriptionSection text={SOURCE} />);

    expect(screen.getByRole('heading', { name: 'Goal' })).toBeDefined();
    expect(screen.queryByText('## Goal')).toBeNull();
  });

  it('keeps a description that is one code fence rendered as a code block', () => {
    const { container } = render(<DescriptionSection text={FENCED} />);

    const code = container.querySelector('pre code');
    expect(code?.textContent).toBe('plain body, not markdown');
    expect(screen.queryByText(/```/)).toBeNull();
  });

  it('shows no edit affordance when no write path is available', () => {
    render(<DescriptionSection text={SOURCE} />);

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    fireEvent.click(screen.getByTestId('description-body'));
    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
  });

  it('enters edit mode on click with the source, restores the rendered view on Escape and keeps the draft', () => {
    render(<DescriptionSection text={SOURCE} onSave={vi.fn(async () => {})} />);

    fireEvent.click(screen.getByTestId('description-body'));
    const field = screen.getByRole('textbox', { name: 'Edit description' }) as HTMLTextAreaElement;
    expect(field.value).toBe(SOURCE);

    fireEvent.change(field, { target: { value: 'typed but not saved' } });
    fireEvent.keyDown(field, { key: 'Escape' });

    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Goal' })).toBeDefined();
    expect(screen.getByText('Unsaved edits')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(
      (screen.getByRole('textbox', { name: 'Edit description' }) as HTMLTextAreaElement).value,
    ).toBe('typed but not saved');
  });

  it('click on a link does not enter edit', () => {
    render(<DescriptionSection text={WITH_LINK} onSave={vi.fn(async () => {})} />);

    fireEvent.click(screen.getByRole('link', { name: 'runbook' }));

    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
  });

  it('click on Load image does not enter edit', () => {
    const load = vi.fn().mockResolvedValue('data:image/png;base64,abc');
    render(
      <RemoteImageLoaderProvider load={load}>
        <DescriptionSection text={WITH_IMAGE} onSave={vi.fn(async () => {})} />
      </RemoteImageLoaderProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load image' }));

    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();
  });

  it('drag selection does not enter edit', () => {
    render(<DescriptionSection text={SOURCE} onSave={vi.fn(async () => {})} />);

    const body = screen.getByTestId('description-body');
    const range = document.createRange();
    range.selectNodeContents(body);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    fireEvent.click(body);

    expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull();

    window.getSelection()?.removeAllRanges();
  });

  it('commits the draft through the write path', async () => {
    const onSave = vi.fn(async () => {});
    render(<DescriptionSection text={SOURCE} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit description' }), {
      target: { value: 'A new body.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('A new body.'));
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Edit description' })).toBeNull(),
    );
  });

  it('keeps the draft and surfaces the error when the save is rejected', async () => {
    const onSave = vi.fn(async () => {
      throw new Error('gh api rejected the update');
    });
    render(<DescriptionSection text={SOURCE} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit description' }), {
      target: { value: 'body that fails' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('gh api rejected the update'),
    );
    expect(
      (screen.getByRole('textbox', { name: 'Edit description' }) as HTMLTextAreaElement).value,
    ).toBe('body that fails');
  });
});
