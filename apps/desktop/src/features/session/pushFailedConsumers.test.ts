// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import type { SessionId, SessionStageInfo } from '@goodboy/types';
import { needsYouEntries } from '../palette/sources/needsYouEntries';
import { sessionNodeOf } from '../workspace/components/SessionActivityBar/sessionNode';
import { sessionTone } from './components/sessionCardShell';
import { ATTENTION_REASON_META, attentionWordsOf, describeSessionStage } from './session-stage';

const SESSION = aSession({
  id: 'session-push-failed' as SessionId,
  goal: 'Stop retried webhooks posting a second credit',
});

const info = (count: number): SessionStageInfo => ({
  stage: 'attention',
  reason: '',
  addsFact: true,
  attention: 'push-failed',
  prState: 'open',
  pushFailedCount: count,
});

describe('every consumer of the session reasons agrees on a push that failed', () => {
  it.each([1, 3])('gives %s failed comment(s) one tone and one set of words', (count) => {
    const stage = info(count);
    const words = attentionWordsOf({ reason: 'push-failed', counts: stage });
    const node = sessionNodeOf({ info: stage, isArchived: false });
    const tone = sessionTone({ stage: stage.stage, attention: stage.attention });
    const [entry] = needsYouEntries({
      items: [{ session: SESSION, info: stage }],
      open: () => undefined,
    });
    const presentation = describeSessionStage(stage);

    expect(words).toBe(count === 1 ? "1 comment didn't go out" : "3 comments didn't go out");
    expect(ATTENTION_REASON_META['push-failed']).toMatchObject({ tone: 'danger', mark: '!' });
    expect(node).toMatchObject({ kind: 'needs', state: 'failed', tone: 'danger', label: words });
    expect(tone.tone).toBe('danger');
    expect(entry?.detail).toBe(words);
    expect(presentation.tone).toBe('danger');
  });
});
