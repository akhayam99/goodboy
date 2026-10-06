// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { askRightNow, askRightNowText, askSuggestions, type AskRightNowInput } from './askRightNow';

const input = (overrides: Partial<AskRightNowInput>): AskRightNowInput => ({
  description: 'Idle',
  commentWords: [],
  prNumber: null,
  runningAgents: [],
  failedAgents: [],
  openQuestionsFrom: [],
  cost: 0,
  ...overrides,
});

describe('askRightNow', () => {
  it('speaks the app’s own words with no model call', () => {
    const lines = askRightNow(
      input({
        commentWords: [
          'ready',
          'ready',
          'ready',
          'ready',
          'ready',
          'needs_you',
          'working',
          'working',
          'couldnt_fix',
          'done',
        ],
        prNumber: 318,
        runningAgents: [{ name: 'Implementer', minutes: 12 }],
        openQuestionsFrom: ['Planner'],
        cost: 3.42,
      }),
    );
    expect(askRightNowText(lines)).toEqual([
      "Fixing 9 comments on #318 · 5 ready · 1 needs you · 2 working · 1 couldn't fix",
      'Implementer is running · 12 min',
      '1 open question from Planner',
      '$3.42 in this session',
    ]);
  });

  it('falls back to the session state and always shows the cost', () => {
    expect(askRightNowText(askRightNow(input({ description: 'Ready to ship' })))).toEqual([
      'Ready to ship',
      '$0.00 in this session',
    ]);
  });

  it('suggests three questions computed from the state', () => {
    expect(
      askSuggestions(input({ openQuestionsFrom: ['Planner'], failedAgents: ['Tester'] })),
    ).toEqual(['What needs me?', 'Why did Tester fail?', 'What changed since I last looked?']);
    expect(askSuggestions(input({}))).toEqual([
      'What changed since I last looked?',
      'What is happening right now?',
      'What is left to do?',
    ]);
  });
});
