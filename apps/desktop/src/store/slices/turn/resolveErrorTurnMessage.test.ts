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

  it('turns a Max Mode failure into an actionable model message', () => {
    const message =
      'ActionRequiredError: Max Mode Required  The model "gpt-5.5-high" requires Max Mode to be enabled.';

    const resolved = resolveErrorTurnMessage({ message, providerId: 'cursor', identity: null });

    expect(resolved).toBe(
      'The model "gpt-5.5-high" requires Max Mode. Enable Max Mode or choose another model.',
    );
  });

  it('tells a Codex user to choose a model supported by their account', () => {
    const message =
      '{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The \'gpt-5.6\' model is not supported when using Codex with a ChatGPT account."}}';

    const resolved = resolveErrorTurnMessage({ message, providerId: 'codex', identity: null });

    expect(resolved).toBe(
      'The model "gpt-5.6" is not available with this Codex account. Choose a model supported by your account.',
    );
  });
});
