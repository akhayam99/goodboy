// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RightSizeCard } from './index'

afterEach(cleanup)

const baseProps = {
  direction: 'lighter' as const,
  kind: 'strong' as const,
  costMultiplier: null as number | null,
  currentModel: 'claude-opus-4-5',
  suggestedModel: 'claude-haiku-4-5',
  onUseSuggested: vi.fn(),
  onKeepCurrent: vi.fn(),
  onChangeModel: vi.fn(),
}

describe('RightSizeCard', () => {
  it('renders the right-sizing nudge with both model labels', () => {
    render(<RightSizeCard {...baseProps} />)
    expect(screen.getByLabelText(/right-sizing/i)).toBeDefined()
  })

  it('renders the lighter copy for downgrades', () => {
    render(<RightSizeCard {...baseProps} />)
    expect(screen.getByText(/this looks light/i)).toBeDefined()
  })

  it('renders the heavier copy for escalations', () => {
    render(
      <RightSizeCard
        {...baseProps}
        direction="heavier"
        kind="strong"
        suggestedModel="claude-fable-5"
      />,
    )
    expect(screen.getByText(/this looks heavy/i)).toBeDefined()
  })

  it('renders a plain savings line for strong lighter suggestions', () => {
    render(<RightSizeCard {...baseProps} costMultiplier={1.7} />)
    expect(screen.getByTestId('right-size-cost-line').textContent).toMatch(/about 1\.7x cheaper/i)
  })

  it('renders an underpowered note for strong heavier suggestions', () => {
    render(
      <RightSizeCard
        {...baseProps}
        direction="heavier"
        kind="strong"
        costMultiplier={null}
        suggestedModel="claude-fable-5"
      />,
    )
    expect(screen.getByTestId('right-size-cost-line').textContent).toMatch(/underpowered/i)
  })

  it('renders soft language and a plain cost line for optional heavier suggestions', () => {
    render(
      <RightSizeCard
        {...baseProps}
        direction="heavier"
        kind="optional"
        costMultiplier={2}
        suggestedModel="claude-fable-5"
      />,
    )
    expect(screen.getByText(/this might run heavy/i)).toBeDefined()
    expect(screen.getByTestId('right-size-cost-line').textContent).toMatch(
      /optional, about 2x cost/i,
    )
  })

  it('omits the multiplier when an optional suggestion has no known cost', () => {
    render(
      <RightSizeCard
        {...baseProps}
        direction="heavier"
        kind="optional"
        costMultiplier={null}
        suggestedModel="claude-fable-5"
      />,
    )
    const line = screen.getByTestId('right-size-cost-line').textContent ?? ''
    expect(line).toMatch(/optional/i)
    expect(line).not.toMatch(/x cost/i)
  })

  it('triggers use-suggested when primary is clicked', () => {
    const onUseSuggested = vi.fn()
    render(<RightSizeCard {...baseProps} onUseSuggested={onUseSuggested} />)
    fireEvent.click(screen.getByTestId('right-size-use-suggested'))
    expect(onUseSuggested).toHaveBeenCalledOnce()
  })

  it('triggers keep-current and change-model from secondary/tertiary', () => {
    const onKeepCurrent = vi.fn()
    const onChangeModel = vi.fn()
    render(
      <RightSizeCard {...baseProps} onKeepCurrent={onKeepCurrent} onChangeModel={onChangeModel} />,
    )
    fireEvent.click(screen.getByTestId('right-size-keep-current'))
    fireEvent.click(screen.getByTestId('right-size-change-model'))
    expect(onKeepCurrent).toHaveBeenCalledOnce()
    expect(onChangeModel).toHaveBeenCalledOnce()
  })
})
