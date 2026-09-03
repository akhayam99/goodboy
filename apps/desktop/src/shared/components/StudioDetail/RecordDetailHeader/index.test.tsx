import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecordDetailHeader } from './index';

afterEach(cleanup);

describe('RecordDetailHeader', () => {
  it('renders record identity, slots and external actions', () => {
    render(
      <RecordDetailHeader
        provider="github"
        identifier="#42"
        title="Fix launch"
        badge={<span>open</span>}
        subtitle={<span>feature to main</span>}
        actions={<button type="button">Approve</button>}
        externalRef={{ url: 'https://github.com/acme/repo/issues/42', label: 'issue' }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Fix launch' })).toBeDefined();
    expect(screen.getByText('#42')).toBeDefined();
    expect(screen.getByText('open')).toBeDefined();
    expect(screen.getByRole('link', { name: /Open in GitHub/ })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDefined();
  });

  it('saves an editable title on blur', () => {
    const onTitleSave = vi.fn();
    render(
      <RecordDetailHeader
        provider="jira"
        identifier="GBY-42"
        title="Old summary"
        onTitleSave={onTitleSave}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Record title' });
    fireEvent.change(input, { target: { value: 'New summary' } });
    fireEvent.blur(input);

    expect(onTitleSave).toHaveBeenCalledWith('New summary');
  });
});
