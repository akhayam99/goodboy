// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { Agent, TelemetryRecord } from '@goodboy/types'
import { AgentMetricsBlock, type AgentAggregate } from '.'

afterEach(cleanup)

const run = {
  id: 'a1',
  startedAt: '2026-05-28T00:00:00Z',
} as unknown as Agent

const aggregate: AgentAggregate = {
  inputTokens: 12000,
  outputTokens: 3000,
  estimatedCostUsd: 0.42,
  turns: 4,
}

describe('AgentMetricsBlock', () => {
  it('renders zeros and 0t when aggregate is null', () => {
    render(
      <AgentMetricsBlock
        run={run}
        telemetry={null}
        aggregate={null}
        turns={0}
        turnsLoading={false}
        variant="adhoc"
      />,
    )
    expect(screen.getByText('0t')).toBeDefined()
  })

  it('renders turn count + cost when aggregate present', () => {
    render(
      <AgentMetricsBlock
        run={run}
        telemetry={null as TelemetryRecord | null}
        aggregate={aggregate}
        turns={4}
        turnsLoading={false}
        variant="workflow"
      />,
    )
    expect(screen.getByText('4t')).toBeDefined()
    expect(screen.getByText('$0')).toBeDefined()
  })

  it('renders a loading placeholder when turnsLoading is true', () => {
    render(
      <AgentMetricsBlock
        run={run}
        telemetry={null}
        aggregate={null}
        turns={0}
        turnsLoading
        variant="adhoc"
      />,
    )
    expect(screen.getByLabelText(/loading turn count/i)).toBeDefined()
  })
})
