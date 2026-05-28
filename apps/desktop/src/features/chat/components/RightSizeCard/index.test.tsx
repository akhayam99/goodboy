// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RightSizeCard } from './index';

afterEach(cleanup);

const baseProps = {
  currentModel: 'claude-opus-4-5',
  suggestedModel: 'claude-haiku-4-5',
  onUseSuggested: vi.fn(),
  onKeepCurrent: vi.fn(),
  onChangeModel: vi.fn(),
};

describe('RightSizeCard', () => {
  it('renders the right-sizing nudge with both model labels', () => {
    render(<RightSizeCard {...baseProps} />);
    expect(screen.getByLabelText(/right-sizing/i)).toBeDefined();
  });

  it('triggers use-suggested when primary is clicked', () => {
    const onUseSuggested = vi.fn();
    render(<RightSizeCard {...baseProps} onUseSuggested={onUseSuggested} />);
    fireEvent.click(screen.getByTestId('right-size-use-suggested'));
    expect(onUseSuggested).toHaveBeenCalledOnce();
  });

  it('triggers keep-current and change-model from secondary/tertiary', () => {
    const onKeepCurrent = vi.fn();
    const onChangeModel = vi.fn();
    render(
      <RightSizeCard {...baseProps} onKeepCurrent={onKeepCurrent} onChangeModel={onChangeModel} />,
    );
    fireEvent.click(screen.getByTestId('right-size-keep-current'));
    fireEvent.click(screen.getByTestId('right-size-change-model'));
    expect(onKeepCurrent).toHaveBeenCalledOnce();
    expect(onChangeModel).toHaveBeenCalledOnce();
  });
});
