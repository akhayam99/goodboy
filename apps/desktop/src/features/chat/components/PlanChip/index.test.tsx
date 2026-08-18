// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { tintClasses } from '@goodboy/ui';
import { CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

const { extractPlanMock, state } = vi.hoisted(() => ({
  extractPlanMock: vi.fn<(text: string) => unknown>(() => null),
  state: {
    sessionPlans: {} as Record<string, ReadonlyArray<{ id: string; title: string }>>,
  },
}));

vi.mock('@goodboy/core', () => ({ extractPlanFromMarker: extractPlanMock }));
vi.mock('../../../../store', () => ({
  useSessionPlans: (sid: string) => state.sessionPlans[sid] ?? [],
}));

import { PlanChip } from './index';

beforeEach(() => {
  extractPlanMock.mockReset();
  state.sessionPlans = {};
});
afterEach(cleanup);

describe('PlanChip', () => {
  it('renders nothing when no plan marker detected', () => {
    extractPlanMock.mockReturnValue(null);
    const { container } = render(<PlanChip assistantText="x" sessionId={'s1' as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a clickable chip with the shared plan tone', () => {
    extractPlanMock.mockReturnValue({ title: 'My Plan', bodyMd: 'body' });
    state.sessionPlans = { s1: [{ id: 'p1', title: 'My Plan' }] };
    render(<PlanChip assistantText="x" sessionId={'s1' as never} />);

    const chip = screen.getByTestId('plan-chip');
    const planTint = tintClasses(CONCEPT_TONE.plans);

    expect(screen.getByText('My Plan')).toBeTruthy();
    expect(chip.className).toContain(planTint.bg);
    expect(chip.className).toContain(planTint.border);
    expect(chip.className).toContain(planTint.text);
  });

  it('dispatches goodboy:open-plan-studio with planId when clicked', () => {
    extractPlanMock.mockReturnValue({ title: 'My Plan', bodyMd: 'body' });
    state.sessionPlans = { s1: [{ id: 'p1', title: 'My Plan' }] };
    render(<PlanChip assistantText="x" sessionId={'s1' as never} />);

    const spy = vi.fn();
    window.addEventListener('goodboy:open-plan-studio', spy);
    fireEvent.click(screen.getByTestId('plan-chip'));
    expect(spy).toHaveBeenCalledTimes(1);
    const detail = (spy.mock.calls[0]![0] as CustomEvent).detail;
    expect(detail.sessionId).toBe('s1');
    expect(detail.planId).toBe('p1');
    window.removeEventListener('goodboy:open-plan-studio', spy);
  });

  it('falls back to last plan when title does not match', () => {
    extractPlanMock.mockReturnValue({ title: 'Unknown', bodyMd: '' });
    state.sessionPlans = { s1: [{ id: 'p2', title: 'Other' }] };
    render(<PlanChip assistantText="x" sessionId={'s1' as never} />);

    const spy = vi.fn();
    window.addEventListener('goodboy:open-plan-studio', spy);
    fireEvent.click(screen.getByTestId('plan-chip'));
    const detail = (spy.mock.calls[0]![0] as CustomEvent).detail;
    expect(detail.planId).toBe('p2');
    window.removeEventListener('goodboy:open-plan-studio', spy);
  });

  it('dispatches without planId when plan store is empty', () => {
    extractPlanMock.mockReturnValue({ title: 'Orphan', bodyMd: '' });
    state.sessionPlans = {};
    render(<PlanChip assistantText="x" sessionId={'s1' as never} />);

    const spy = vi.fn();
    window.addEventListener('goodboy:open-plan-studio', spy);
    fireEvent.click(screen.getByTestId('plan-chip'));
    const detail = (spy.mock.calls[0]![0] as CustomEvent).detail;
    expect(detail.sessionId).toBe('s1');
    expect(detail.planId).toBeUndefined();
    window.removeEventListener('goodboy:open-plan-studio', spy);
  });

  it('picks the exact title match over fallback to last', () => {
    extractPlanMock.mockReturnValue({ title: 'Target', bodyMd: '' });
    state.sessionPlans = {
      s1: [
        { id: 'p1', title: 'Other' },
        { id: 'p2', title: 'Target' },
        { id: 'p3', title: 'Last' },
      ],
    };
    render(<PlanChip assistantText="x" sessionId={'s1' as never} />);

    const spy = vi.fn();
    window.addEventListener('goodboy:open-plan-studio', spy);
    fireEvent.click(screen.getByTestId('plan-chip'));
    const detail = (spy.mock.calls[0]![0] as CustomEvent).detail;
    expect(detail.planId).toBe('p2');
    window.removeEventListener('goodboy:open-plan-studio', spy);
  });
});
