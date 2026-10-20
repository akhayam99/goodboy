// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U27_RAIL_CHAT_CARDS_SCENES } from './rail-chat-cards';

afterEach(cleanup);

describe('rail and chat cards scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U27_RAIL_CHAT_CARDS_SCENES)).toEqual(['rail-chat-cards']);
    expect(MOCK_SCENES['rail-chat-cards']).toBe(U27_RAIL_CHAT_CARDS_SCENES['rail-chat-cards']);
  });

  it('opens the rail row, routing, chat, answer, service, work time and clock cards at once', () => {
    const Scene = U27_RAIL_CHAT_CARDS_SCENES['rail-chat-cards'];
    render(<Scene />);

    const cards = screen.getAllByTestId('fact-card');
    expect(cards).toHaveLength(7);
    expect(cards[0]?.textContent).toContain('Implementer');
    expect(cards[1]?.textContent).toContain('Planned Opus 5 High, routing picked Sonnet 5 High');
    expect(cards[2]?.textContent).toContain('2 sessions');
    expect(cards[3]?.textContent).toContain('Read');
    expect(cards[4]?.textContent).toContain('Memory');
    expect(cards[5]?.textContent).toContain('Longer than usual');
    expect(cards[6]?.textContent).toContain('Finished');
  });
});
