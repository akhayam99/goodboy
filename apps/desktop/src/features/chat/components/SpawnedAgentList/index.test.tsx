// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AgentId } from '@goodboy/types'
import { SpawnedAgentList, type SpawnedAgentItem } from './index'

afterEach(cleanup)

const item = (over: Partial<SpawnedAgentItem> = {}): SpawnedAgentItem => ({
  key: over.key ?? 'k0',
  index: 0,
  total: 2,
  name: 'scout-a',
  body: null,
  status: 'planned',
  agentId: null,
  ...over,
})

describe('SpawnedAgentList', () => {
  it('renders nothing visible for an empty list', () => {
    const { container } = render(<SpawnedAgentList items={[]} />)
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.textContent).toBe('')
  })

  it('renders the 1-based index over the total for each row', () => {
    render(
      <SpawnedAgentList
        items={[item({ key: 'a', index: 0, total: 3 }), item({ key: 'b', index: 2, total: 3 })]}
      />,
    )
    expect(screen.getByText('1/3')).toBeTruthy()
    expect(screen.getByText('3/3')).toBeTruthy()
  })

  it('maps each status to its human label', () => {
    render(
      <SpawnedAgentList
        items={[
          item({ key: 'r', name: 'a', status: 'running' }),
          item({ key: 'c', name: 'b', status: 'completed' }),
          item({ key: 'f', name: 'c', status: 'failed' }),
          item({ key: 'p', name: 'd', status: 'pending' }),
          item({ key: 'pl', name: 'e', status: 'planned' }),
        ]}
      />,
    )
    expect(screen.getByText('running…')).toBeTruthy()
    expect(screen.getByText('done')).toBeTruthy()
    expect(screen.getByText('stalled')).toBeTruthy()
    expect(screen.getByText('queued')).toBeTruthy()
    expect(screen.getByText('planned')).toBeTruthy()
  })

  it('shows the body line when present and omits it when null', () => {
    render(
      <SpawnedAgentList
        items={[
          item({ key: 'with', name: 'has-body', body: 'do the thing' }),
          item({ key: 'without', name: 'no-body', body: null }),
        ]}
      />,
    )
    expect(screen.getByText('do the thing')).toBeTruthy()
    expect(screen.queryByText('null')).toBeNull()
  })

  it('renders a clickable button and fires onSelect with the agent id when navigable', () => {
    const onSelect = vi.fn()
    render(
      <SpawnedAgentList
        items={[item({ agentId: 'agent-1' as AgentId, name: 'clickable' })]}
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith('agent-1')
  })

  it('renders a non-interactive row when the item has no agent id', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <SpawnedAgentList items={[item({ agentId: null })]} onSelect={onSelect} />,
    )
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('renders a non-interactive row when no onSelect handler is provided', () => {
    const { container } = render(
      <SpawnedAgentList items={[item({ agentId: 'agent-1' as AgentId })]} />,
    )
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('keeps every navigable row clickable even when one is selected', () => {
    const onSelect = vi.fn()
    render(
      <SpawnedAgentList
        items={[
          item({ key: 'a', name: 'a', agentId: 'agent-1' as AgentId }),
          item({ key: 'b', name: 'b', agentId: 'agent-2' as AgentId }),
        ]}
        selectedAgentId={'agent-1' as AgentId}
        onSelect={onSelect}
      />,
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    fireEvent.click(buttons[1]!)
    expect(onSelect).toHaveBeenCalledWith('agent-2')
  })
})
