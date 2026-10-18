// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentRole, StepSize } from '@goodboy/types';
import type { StepDraft } from '../../engine';
import { StepModelFields } from './StepModelFields';

type DraftParams = {
  readonly role: AgentRole;
  readonly size: StepSize | null;
};

const draftOf = ({ role, size }: DraftParams): StepDraft => ({
  key: 'step-1',
  sourceStepId: null,
  libraryStepId: null,
  role,
  name: 'Rewrite the retry policy',
  prompt: 'Rewrite the ledger-core retry policy',
  expectedOutput: 'a patch',
  provider: '',
  model: '',
  effort: 'high',
  verbosity: 'normal',
  size,
});

const renderFields = ({ role, size }: DraftParams) =>
  render(
    <StepModelFields
      step={draftOf({ role, size })}
      routingLabel="Step routing"
      effort="high"
      recommendedProvider="anthropic"
      recommendedModel="sonnet-5.5"
      connectedProviders={['anthropic']}
      isRoutingOverridden={false}
      isDisabled={false}
      onRoute={vi.fn()}
      onRoutingReset={vi.fn()}
      onPin={vi.fn()}
    />,
  );

afterEach(cleanup);

describe('StepModelFields', () => {
  it('says the size moved the pick for a large step of a role that climbs', () => {
    renderFields({ role: 'implementer', size: 'large' });

    expect(screen.getByTestId('step-follows-role').textContent).toContain(
      'Sonnet 5.5 · High · sized for a large step',
    );
  });

  it('says the size moved the pick for a small step', () => {
    renderFields({ role: 'implementer', size: 'small' });

    expect(screen.getByTestId('step-follows-role').textContent).toContain('sized for a small step');
  });

  it('adds nothing when the size does not move the role', () => {
    renderFields({ role: 'custom', size: 'large' });

    expect(screen.getByTestId('step-follows-role').textContent).not.toContain('sized for');
  });

  it('adds nothing for a step without a size', () => {
    renderFields({ role: 'implementer', size: null });

    expect(screen.getByTestId('step-follows-role').textContent).not.toContain('sized for');
  });
});
