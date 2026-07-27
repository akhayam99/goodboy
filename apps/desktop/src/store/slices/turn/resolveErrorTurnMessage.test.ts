import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@goodboy/types';
import { decodeAuthRequiredMessage } from '../../../features/chat/turn';
import { resolveErrorTurnMessage } from './resolveErrorTurnMessage';

const ANTHROPIC = 'anthropic' as ProviderId;

describe('resolveErrorTurnMessage', () => {
  it('encodes an OAuth-expired 401 message into an auth_required payload', () => {
    const message =
      'Failed to authenticate. API Error: 401 {"type":"error","error":{"type":"authentication_error","message":"OAuth access token has expired. Re-authenticate to continue."},"request_id":null}';

    const resolved = resolveErrorTurnMessage({ message, providerId: ANTHROPIC, identity: 'jane' });

    expect(decodeAuthRequiredMessage(resolved)).toEqual({
      providerId: ANTHROPIC,
      identity: 'jane',
    });
  });

  it('leaves a non-auth provider error message verbatim', () => {
    const message = 'connection reset by peer';

    const resolved = resolveErrorTurnMessage({ message, providerId: ANTHROPIC, identity: null });

    expect(resolved).toBe(message);
    expect(decodeAuthRequiredMessage(resolved)).toBeNull();
  });

  it('leaves our own static app copy (budget exceeded) verbatim', () => {
    const message =
      'All providers have exceeded their budget cap. Adjust budget rules or wait for the next billing period.';

    const resolved = resolveErrorTurnMessage({ message, providerId: ANTHROPIC, identity: null });

    expect(resolved).toBe(message);
  });
});
