// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Dialog } from '@goodboy/ui'

afterEach(cleanup)

describe('Dialog, aria associations', () => {
  it('renders aria-labelledby pointing to title element', () => {
    const { container } = render(
      <Dialog open={true} onClose={() => undefined} title="test title">
        <p>content</p>
      </Dialog>,
    )
    const dialog = container.querySelector('dialog')
    expect(dialog).not.toBeNull()
    const labelledBy = dialog?.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const titleEl = container.querySelector(`#${labelledBy}`)
    expect(titleEl?.textContent).toBe('test title')
  })

  it('renders aria-describedby pointing to description element', () => {
    const { container } = render(
      <Dialog open={true} onClose={() => undefined} title="t" description="desc text">
        <p>content</p>
      </Dialog>,
    )
    const dialog = container.querySelector('dialog')
    const describedBy = dialog?.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const descEl = container.querySelector(`#${describedBy}`)
    expect(descEl?.textContent).toBe('desc text')
  })

  it('omits aria-labelledby when no title provided', () => {
    const { container } = render(
      <Dialog open={true} onClose={() => undefined} showClose={false}>
        <p>content</p>
      </Dialog>,
    )
    const dialog = container.querySelector('dialog')
    expect(dialog?.getAttribute('aria-labelledby')).toBeNull()
  })

  it('omits aria-describedby when no description provided', () => {
    const { container } = render(
      <Dialog open={true} onClose={() => undefined} title="only title">
        <p>content</p>
      </Dialog>,
    )
    const dialog = container.querySelector('dialog')
    expect(dialog?.getAttribute('aria-describedby')).toBeNull()
  })
})
