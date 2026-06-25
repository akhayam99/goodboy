// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CustomAnswerField } from '.'

afterEach(cleanup)

describe('CustomAnswerField', () => {
  it('renders the open trigger when closed and fires onToggle', () => {
    const onToggle = vi.fn()
    render(
      <CustomAnswerField value="" open={false} onToggle={onToggle} onChange={() => undefined} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /other/i }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('renders a textarea when open and forwards typed value', () => {
    const onChange = vi.fn()
    render(<CustomAnswerField value="" open onToggle={() => undefined} onChange={onChange} />)
    const textarea = screen.getByPlaceholderText(/write your own answer/i)
    fireEvent.change(textarea, { target: { value: 'hi' } })
    expect(onChange).toHaveBeenCalledWith('hi')
  })
})
