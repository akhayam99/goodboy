// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

type RoutingBadgeProps = {
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly effort?: string | null;
};

const routingBadgeSpy = vi.hoisted(() => vi.fn(({}: RoutingBadgeProps) => null));

vi.mock('../../../../../shared/components/RoutingBadge', () => ({
  RoutingBadge: routingBadgeSpy,
}));

import { QueuedMessages } from './QueuedMessages';

beforeEach(() => {
  routingBadgeSpy.mockClear();
});

afterEach(cleanup);

describe('QueuedMessages', () => {
  it('renders each routing badge from the queued item override', () => {
    render(
      <QueuedMessages
        items={[
          {
            id: 'turn-1',
            content: 'queued turn',
            attachments: [],
            override: {
              providerId: 'codex',
              model: 'gpt-5.4',
              selection: { key: 'gpt-5.4-mini', effort: 'xhigh' },
            },
          },
        ]}
        canEdit
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(routingBadgeSpy).toHaveBeenCalledOnce();
    expect(routingBadgeSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        provider: 'codex',
        model: 'gpt-5.4',
        effort: 'xhigh',
      }),
    );
  });
});
