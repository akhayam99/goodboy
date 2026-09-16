import { describe, expect, it } from 'vitest';
import { REDACTED, redactSecrets } from './redactSecrets';

describe('redactSecrets', () => {
  it('removes the token after an authorization scheme, not just the scheme word', () => {
    const text = redactSecrets({ text: 'Authorization: Bearer abcdefghijklmnop' });
    expect(text).not.toContain('abcdefghijklmnop');
    expect(text).toBe(`Authorization: ${REDACTED}`);
  });

  it('removes a basic credential whose scheme word is shorter than the value bound', () => {
    const text = redactSecrets({ text: 'Authorization: Basic dXNlcjpwYXNzd29yZA==' });
    expect(text).not.toContain('dXNlcjpwYXNzd29yZA==');
    expect(text).not.toContain('Basic');
  });

  it('removes a token credential behind a labelled header', () => {
    const text = redactSecrets({ text: 'access-token: Token 9f8e7d6c5b4a3210' });
    expect(text).not.toContain('9f8e7d6c5b4a3210');
  });

  it('removes a single quoted value and a quoted value containing spaces', () => {
    const single = redactSecrets({ text: "secret: 'topsecretvalue1'" });
    const spaced = redactSecrets({ text: 'password: "correct horse battery"' });
    expect(single).not.toContain('topsecretvalue1');
    expect(spaced).not.toContain('correct horse battery');
  });

  it('removes a credential embedded in a quoted curl header', () => {
    const text = redactSecrets({
      text: 'curl -H "Authorization: Bearer sk_live_abcdefghijklmnop" https://example.test',
    });
    expect(text).not.toContain('sk_live_abcdefghijklmnop');
    expect(text).toContain('https://example.test');
  });

  it('removes every labelled credential on separate lines', () => {
    const text = redactSecrets({ text: 'password: firstsecret1\napi_key: secondsecret2' });
    expect(text).not.toContain('firstsecret1');
    expect(text).not.toContain('secondsecret2');
  });

  it('removes opaque provider tokens wherever they appear', () => {
    const text = redactSecrets({
      text: 'ghp_abcdefghijklmnopqrstuvwxyz012345 xoxb-1234567890-abcdefghijkl AKIAIOSFODNN7EXAMPLE',
    });
    expect(text).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz012345');
    expect(text).not.toContain('xoxb-1234567890-abcdefghijkl');
    expect(text).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('removes an aws temporary session key id, not only a long term one', () => {
    const text = redactSecrets({
      text: 'AKIAIOSFODNN7EXAMPLE and ASIAY34FZKBOKMUTVV7A',
    });
    expect(text).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(text).not.toContain('ASIAY34FZKBOKMUTVV7A');
  });

  it('removes a json web token in any of its three segments', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const text = redactSecrets({ text: `token ${jwt}` });
    expect(text).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(text).not.toContain('dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk');
  });

  it('leaves prose that merely mentions a label untouched', () => {
    expect(redactSecrets({ text: 'the secret is out' })).toBe('the secret is out');
    expect(redactSecrets({ text: 'fix(auth): rotate api key handling' })).toBe(
      'fix(auth): rotate api key handling',
    );
  });
});
