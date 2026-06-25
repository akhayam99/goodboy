// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }))

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}))

import { BranchChip } from './BranchChip'

const writeText = vi.fn(async () => undefined)

beforeEach(() => {
  toastMock.mockReset()
  writeText.mockReset()
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
})
afterEach(cleanup)

describe('BranchChip', () => {
  it('renders the branch name', () => {
    render(<BranchChip branch="ak/feat-thing" />)
    expect(screen.getByText('ak/feat-thing')).toBeDefined()
  })

  it('copies the branch and toasts success on click', async () => {
    render(<BranchChip branch="ak/feat-thing" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('ak/feat-thing'))
    expect(toastMock).toHaveBeenCalledWith('success', 'branch copied')
  })

  it('toasts an error when the clipboard write fails', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    render(<BranchChip branch="ak/feat-thing" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith('error', expect.stringMatching(/copy failed/i)),
    )
  })
})
