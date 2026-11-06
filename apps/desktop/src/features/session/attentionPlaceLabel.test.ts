// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { branchPlace } from '../../store/slices/navigation/place';
import { attentionPlaceLabelOf } from './attentionPlaceLabel';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });

describe('attentionPlaceLabelOf', () => {
  it.each([
    ['ci-failed', 'Open Checks'],
    ['push-failed', 'Open Comments'],
    ['fix-needs-you', 'Open Comments'],
    ['pr-opened', 'Open pull request'],
    ['pr-approved', 'Open pull request'],
    ['history-stopped', 'Open branch'],
    ['agent-error', 'Open agent'],
  ])('names the place for %s', (reason, label) => {
    expect(attentionPlaceLabelOf({ reason })).toBe(label);
  });

  it('names the host noun of a request: a GitLab row opens a merge request', () => {
    expect(attentionPlaceLabelOf({ reason: 'pr-opened', host: 'gitlab' })).toBe(
      'Open merge request',
    );
    expect(attentionPlaceLabelOf({ reason: 'changes-requested', host: 'gitlab' })).toBe(
      'Open merge request',
    );
    expect(attentionPlaceLabelOf({ reason: 'pr-approved', host: 'github' })).toBe(
      'Open pull request',
    );
  });

  it('names Changes when a fix row lands on the Changes tab, Comments otherwise', () => {
    const files = branchPlace({ sessionId: SESSION_ID, tab: 'files' });
    const comments = branchPlace({ sessionId: SESSION_ID, tab: 'comments' });

    expect(attentionPlaceLabelOf({ reason: 'fix-needs-you', place: files })).toBe('Open Changes');
    expect(attentionPlaceLabelOf({ reason: 'fix-couldnt-fix', place: files })).toBe('Open Changes');
    expect(attentionPlaceLabelOf({ reason: 'fix-needs-you', place: comments })).toBe(
      'Open Comments',
    );
    expect(attentionPlaceLabelOf({ reason: 'push-failed', place: files })).toBe('Open Comments');
  });

  it('falls back to the session for no reason and for one it does not know', () => {
    expect(attentionPlaceLabelOf({ reason: null })).toBe('Open session');
    expect(attentionPlaceLabelOf({ reason: 'from-a-newer-build' })).toBe('Open session');
  });
});
