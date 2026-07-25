// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { TelemetryRecord } from '@goodboy/types';
import { AgentMetricsInline } from './index';

afterEach(cleanup);

const telemetry = (over: Partial<TelemetryRecord> = {}): TelemetryRecord =>
  ({
    runId: 'run-1',
    kind: 'turn',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    inputTokens: 10,
    outputTokens: 2,
    estimatedCostUsd: 0.25,
    recordedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as TelemetryRecord;

describe('AgentMetricsInline', () => {
  it('shows the short model label, cost, context share and turns', () => {
    render(
      <AgentMetricsInline
        telemetry={telemetry()}
        aggregate={{
          inputTokens: 100_000,
          outputTokens: 0,
          estimatedCostUsd: 1.25,
          turns: 4,
        }}
        contextUsage={[
          {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
            inputTokens: 100_000,
            outputTokens: 0,
          },
        ]}
        turns={4}
        turnsLoading={false}
      />,
    );
    expect(screen.getByText('sonnet 4.5')).toBeTruthy();
    expect(screen.getByText('4t')).toBeTruthy();
    expect(screen.getByText(/ctx \d+%/)).toBeTruthy();
    expect(screen.getByTestId('agent-metrics-inline').textContent).toContain('$');
  });

  it('tints the context share by pressure', () => {
    render(
      <AgentMetricsInline
        telemetry={telemetry()}
        aggregate={null}
        contextUsage={[
          {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
            inputTokens: 1_000_000,
            outputTokens: 0,
          },
        ]}
        turns={0}
        turnsLoading={false}
      />,
    );
    expect(screen.getByText('ctx 100%').className).toContain('text-danger');
  });

  it('stays readable for an agent that never ran', () => {
    render(
      <AgentMetricsInline
        telemetry={null}
        aggregate={null}
        contextUsage={[]}
        turns={0}
        turnsLoading={false}
      />,
    );
    expect(screen.getByText('no model yet')).toBeTruthy();
    expect(screen.getByText('ctx 0%')).toBeTruthy();
    expect(screen.getByText('0t')).toBeTruthy();
  });

  it('shows a loading placeholder instead of the turn count while the transcript loads', () => {
    render(
      <AgentMetricsInline
        telemetry={telemetry()}
        aggregate={null}
        contextUsage={[]}
        turns={0}
        turnsLoading
      />,
    );
    expect(screen.getByLabelText(/loading turn count/i)).toBeDefined();
    expect(screen.queryByText('0t')).toBeNull();
  });

  it('names the planned model for a step that has not run yet', () => {
    render(
      <AgentMetricsInline
        telemetry={null}
        aggregate={null}
        contextUsage={[]}
        turns={0}
        turnsLoading={false}
        plannedModel="claude-opus-4-5"
        muted
      />,
    );
    expect(screen.getByText('opus 4.5')).toBeDefined();
    expect(screen.queryByText('no model yet')).toBeNull();
    expect(screen.getByTestId('agent-metrics-inline').className).toContain('opacity-60');
  });

  it('falls back to the dominant context provider model when telemetry is missing', () => {
    render(
      <AgentMetricsInline
        telemetry={null}
        aggregate={null}
        contextUsage={[
          { provider: 'anthropic', model: 'claude-haiku-4-5', inputTokens: 10, outputTokens: 1 },
        ]}
        turns={1}
        turnsLoading={false}
      />,
    );
    expect(screen.getByText('haiku 4.5')).toBeTruthy();
  });
});
