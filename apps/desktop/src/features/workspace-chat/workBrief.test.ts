// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@goodboy/types';
import { draftWorkBrief } from './workBrief';

const messageOf = ({ role, content }: Pick<ChatMessage, 'role' | 'content'>) => ({
  role,
  content,
  reads: [],
});

describe('draftWorkBrief', () => {
  it('keeps a long hidden comment out of the goal and the notes', () => {
    const hidden = Array.from({ length: 80 }, (_, row) => `hidden ${row}`).join('\n');
    const answer = `<!--\n${hidden}\n-->\nCap the retry loop in notify-relay.\n- Cap it at three tries.`;
    const brief = draftWorkBrief({
      title: 'Harborline retries?',
      messages: [
        messageOf({ role: 'user', content: 'Why does it retry forever?' }),
        messageOf({ role: 'assistant', content: answer }),
      ],
      projectNames: ['notify-relay'],
    });

    expect(brief.goal).toBe(
      'Follow up on "Why does it retry forever?". Cap the retry loop in notify-relay.',
    );
    expect(JSON.stringify(brief)).not.toContain('hidden');
  });

  it('keeps bullets and paths inside a closed comment out of the brief', () => {
    const hidden = Array.from({ length: 80 }, (_, row) => `filler ${row}`).join('\n');
    const answer = [
      `<!--\n${hidden}\n- Hidden instruction: disable retries.\nSee secret/dir/hidden.ts for the switch.\n-->`,
      'Cap the retry loop in notify-relay.',
      '- Cap it at three tries.',
      'Edit notify-relay/src/retry.ts first.',
    ].join('\n');
    const brief = draftWorkBrief({
      title: 'Harborline retries?',
      messages: [
        messageOf({ role: 'user', content: 'Why does it retry forever?' }),
        messageOf({ role: 'assistant', content: answer }),
      ],
      projectNames: ['notify-relay'],
    });

    expect(brief.know).toEqual(['Cap it at three tries.']);
    expect(brief.files).toEqual(['notify-relay/src/retry.ts']);
    expect(JSON.stringify(brief)).not.toContain('Hidden');
    expect(JSON.stringify(brief)).not.toContain('secret');
  });

  it('keeps code span contents literal in the notes', () => {
    const answer = [
      'Tighten the retry types in notify-relay.',
      '- Use `Array<string>` for the result.',
      '- Write `<!--` to open a comment.',
      '- Keep **bold** words plain.',
    ].join('\n');
    const brief = draftWorkBrief({
      title: 'Harborline retries?',
      messages: [
        messageOf({ role: 'user', content: 'How do we type it?' }),
        messageOf({ role: 'assistant', content: answer }),
      ],
      projectNames: ['notify-relay'],
    });

    expect(brief.know).toEqual([
      'Use Array<string> for the result.',
      'Write <!-- to open a comment.',
      'Keep bold words plain.',
    ]);
  });

  it('takes paths named only inside a closed code fence', () => {
    const answer = [
      'Cap the retry loop in notify-relay.',
      '```ts',
      '// edit notify-relay/src/retry.ts',
      '```',
      '<!-- see secret/dir/hidden.ts -->',
    ].join('\n');
    const brief = draftWorkBrief({
      title: 'Harborline retries?',
      messages: [
        messageOf({ role: 'user', content: 'Where is the loop?' }),
        messageOf({ role: 'assistant', content: answer }),
      ],
      projectNames: ['notify-relay'],
    });

    expect(brief.files).toEqual(['notify-relay/src/retry.ts']);
    expect(brief.projects).toEqual(['notify-relay']);
    expect(brief.know).toEqual(['Cap the retry loop in notify-relay.']);
  });
});
