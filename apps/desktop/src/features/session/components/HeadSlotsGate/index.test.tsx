// @vitest-environment happy-dom

import { useContext } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SessionHeadSlotsContext, type SessionHeadSlots } from '../../sessionHeadSlotsContext';
import { HeadSlotsGate } from '.';

afterEach(cleanup);

const node = (): HTMLElement => document.createElement('div');

const SLOTS: SessionHeadSlots = {
  title: node(),
  meta: node(),
  aside: node(),
  lead: node(),
  frame: node(),
  isTitleClaimed: false,
  isHeadingClaimed: false,
  setTitle: () => undefined,
  setMeta: () => undefined,
  claim: () => undefined,
};

const Probe = () => {
  const slots = useContext(SessionHeadSlotsContext);
  const shown = [
    slots?.title == null ? null : 'title',
    slots?.aside == null ? null : 'aside',
    slots?.lead == null ? null : 'lead',
    slots?.frame == null ? null : 'frame',
  ].filter((part) => part !== null);
  return <span data-testid="probe">{shown.join(' ')}</span>;
};

type GateParams = {
  readonly isOpen: boolean;
};

const renderGate = ({ isOpen }: GateParams) =>
  render(
    <SessionHeadSlotsContext.Provider value={SLOTS}>
      <HeadSlotsGate isOpen={isOpen}>
        <Probe />
      </HeadSlotsGate>
    </SessionHeadSlotsContext.Provider>,
  );

describe('HeadSlotsGate', () => {
  it('hands the page on screen every slot of the frame, the left one included', () => {
    renderGate({ isOpen: true });
    expect(screen.getByTestId('probe').textContent).toBe('title aside lead frame');
  });

  it('gives a hidden layer no slot to fill, so a kept Changes tab draws no files rail', () => {
    renderGate({ isOpen: false });
    expect(screen.getByTestId('probe').textContent).toBe('frame');
  });
});
