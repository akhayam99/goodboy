// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DialogSectionHeader } from '../components/DialogSectionHeader';

afterEach(cleanup);

describe('DialogSectionHeader', () => {
  it('renders the title and the icon', () => {
    render(<DialogSectionHeader icon={<svg data-testid="icon" />} title="General" />);
    expect(screen.getByRole('heading', { name: 'General' })).toBeDefined();
    expect(screen.getByTestId('icon')).toBeDefined();
  });

  it('omits the description paragraph when none is given', () => {
    const { container } = render(<DialogSectionHeader icon={<svg />} title="General" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('renders the description when provided', () => {
    render(
      <DialogSectionHeader icon={<svg />} title="General" description="workspace level settings" />,
    );
    expect(screen.getByText('workspace level settings')).toBeDefined();
  });

  it('hides the beta badge by default', () => {
    render(<DialogSectionHeader icon={<svg />} title="General" />);
    expect(screen.queryByText('beta')).toBeNull();
  });

  it('shows the beta badge when flagged', () => {
    render(<DialogSectionHeader icon={<svg />} title="Experimental" beta />);
    expect(screen.getByText('beta')).toBeDefined();
  });

  it('applies the danger tone to the title', () => {
    render(<DialogSectionHeader icon={<svg />} title="Danger zone" tone="danger" />);
    expect(screen.getByRole('heading', { name: 'Danger zone' }).className).toContain('text-danger');
  });

  it('defaults to the primary tone tile', () => {
    const { container } = render(<DialogSectionHeader icon={<svg />} title="General" />);
    expect(container.querySelector('span')?.className).toContain('bg-primary/10');
  });

  it('merges a custom className onto the root', () => {
    const { container } = render(
      <DialogSectionHeader icon={<svg />} title="General" className="mb-4" />,
    );
    expect((container.firstChild as HTMLElement).className).toContain('mb-4');
  });
});
