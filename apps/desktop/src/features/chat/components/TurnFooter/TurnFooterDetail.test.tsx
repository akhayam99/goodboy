// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TurnFooterDetail } from './TurnFooterDetail';
import type { TurnFooterData } from './useTurnFooter';

const DATA: TurnFooterData = {
  provider: null,
  model: null,
  effort: null,
  inputTokens: 1200,
  outputTokens: 300,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  contextTokens: 50000,
  estimatedCostUsd: null,
};

const mount = (contextWindow: number | null) =>
  render(
    <TurnFooterDetail
      data={DATA}
      totalInput={1200}
      cachedPct={null}
      contextWindow={contextWindow}
      duration={null}
      startedAt={null}
      endedAt={null}
    />,
  );

afterEach(cleanup);

describe('TurnFooterDetail', () => {
  it('names the share of the model context window a turn filled', () => {
    mount(200000);
    expect(screen.getByText('Context window')).toBeDefined();
    expect(screen.getByText(/25%/)).toBeDefined();
  });

  it('leaves the context window row out when the model reports none', () => {
    mount(null);
    expect(screen.queryByText('Context window')).toBeNull();
  });
});
