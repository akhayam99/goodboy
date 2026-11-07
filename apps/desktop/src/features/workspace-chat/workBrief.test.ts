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
});
