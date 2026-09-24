// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkflowsRail } from './index';

afterEach(cleanup);

const Harness = ({ onReset }: { readonly onReset: () => void }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <WorkflowsRail
      presets={[]}
      activeId={null}
      resetting={false}
      confirmReset={confirmReset}
      setConfirmReset={setConfirmReset}
      onSelect={vi.fn()}
      onNew={vi.fn()}
      onReset={onReset}
      importSection={null}
    />
  );
};

describe('WorkflowsRail', () => {
  it('restores the built-in presets only after the row confirm', () => {
    const onReset = vi.fn();
    render(<Harness onReset={onReset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Restore defaults' }));
    expect(onReset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('brings the trigger back when the restore is cancelled', () => {
    const onReset = vi.fn();
    render(<Harness onReset={onReset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Restore defaults' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Restore defaults' })).toBeDefined();
  });
});
