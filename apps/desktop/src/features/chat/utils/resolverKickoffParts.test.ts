import { describe, expect, it } from 'vitest';
import {
  humanOfKickoff,
  joinKickoffParts,
  kickoffTail,
  rulesOfKickoff,
  type KickoffParts,
} from './resolverKickoffParts';

const parts = ({ hint }: { readonly hint: string }): KickoffParts => ({
  head: 'Fix the comment on src/a.ts:4.',
  rules: 'Reply contract:\nend with <<comment-resolved>>.',
  tail: kickoffTail({ hint }),
});

describe('resolver kickoff parts', () => {
  it('joins head, rules and note in the order the provider reads them', () => {
    const joined = joinKickoffParts(parts({ hint: 'Keep the metrics.' }));

    expect(joined.startsWith('Fix the comment on src/a.ts:4.\n\nReply contract:')).toBe(true);
    expect(joined.endsWith('Keep the metrics.')).toBe(true);
  });

  it('keeps the human part to the head and the note', () => {
    const human = humanOfKickoff(parts({ hint: 'Keep the metrics.' }));

    expect(human).toContain('Fix the comment on src/a.ts:4.');
    expect(human).toContain('Keep the metrics.');
    expect(human).not.toContain('Reply contract');
  });

  it('adds no note block for a blank hint', () => {
    expect(kickoffTail({ hint: '   ' })).toBe('');
  });

  it.each(['', 'Keep the metrics.'])(
    'recovers the rules from the full message (note %j)',
    (hint) => {
      const value = parts({ hint });

      expect(
        rulesOfKickoff({ message: joinKickoffParts(value), human: humanOfKickoff(value) }),
      ).toBe(value.rules);
    },
  );

  it('gives up when the human part is not what the message was built from', () => {
    const value = parts({ hint: '' });

    expect(
      rulesOfKickoff({ message: joinKickoffParts(value), human: 'Something else.' }),
    ).toBeNull();
  });

  it('gives up when the message has no rules between head and note', () => {
    expect(rulesOfKickoff({ message: 'Same text.', human: 'Same text.' })).toBeNull();
  });
});
