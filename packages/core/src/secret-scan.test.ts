import { describe, expect, it } from 'vitest';
import { findSecretMatches, scanTextForSecrets } from './secret-scan';

describe('findSecretMatches', () => {
  it('finds a github personal access token', () => {
    const value = `ghp_${'a'.repeat(36)}`;
    expect(findSecretMatches({ text: `token: ${value}` })).toEqual([
      { kind: 'github-token', value },
    ]);
  });

  it('finds a github fine-grained token', () => {
    const value = `github_pat_${'a'.repeat(30)}`;
    expect(findSecretMatches({ text: value })[0]?.kind).toBe('github-fine-grained-token');
  });

  it('finds an openai-shaped key but not a bare sk- in a sentence', () => {
    expect(findSecretMatches({ text: 'sk-fi is a typo for ski' })).toEqual([]);
    const value = `sk-${'a'.repeat(30)}`;
    expect(findSecretMatches({ text: value })[0]?.kind).toBe('openai-key');
  });

  it('finds slack bot and user tokens', () => {
    const bot = 'xoxb-1234567890-abcdefghij';
    const user = 'xoxp-1234567890-abcdefghij';
    expect(findSecretMatches({ text: bot })[0]?.kind).toBe('slack-bot-token');
    expect(findSecretMatches({ text: user })[0]?.kind).toBe('slack-user-token');
  });

  it('finds linear and gitlab tokens', () => {
    const linear = `lin_api_${'a'.repeat(30)}`;
    const gitlab = `glpat-${'a'.repeat(24)}`;
    expect(findSecretMatches({ text: linear })[0]?.kind).toBe('linear-api-key');
    expect(findSecretMatches({ text: gitlab })[0]?.kind).toBe('gitlab-token');
  });

  it('finds an aws access key id', () => {
    const value = `AKIA${'A'.repeat(16)}`;
    expect(findSecretMatches({ text: value })[0]?.kind).toBe('aws-access-key');
  });

  it('finds a pem private key header', () => {
    const text = '-----BEGIN RSA PRIVATE KEY-----\nMIIB...\n-----END RSA PRIVATE KEY-----';
    expect(findSecretMatches({ text })[0]?.kind).toBe('private-key');
  });

  it('finds a jwt', () => {
    const jwt = `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.${'a'.repeat(20)}`;
    expect(findSecretMatches({ text: jwt })[0]?.kind).toBe('jwt');
  });

  it('finds a KEY=/TOKEN=/SECRET= assignment with a long value, not a short one', () => {
    expect(findSecretMatches({ text: 'DEPLOY_TOKEN=short' })).toEqual([]);
    const value = 'a'.repeat(20);
    expect(findSecretMatches({ text: `DEPLOY_TOKEN=${value}` })).toEqual([
      { kind: 'generic-secret', value },
    ]);
  });
});

describe('scanTextForSecrets', () => {
  it('fingerprints a finding with a stable sha256 and the last four characters', async () => {
    const value = `ghp_${'a'.repeat(36)}`;
    const [first] = await scanTextForSecrets({ text: value });
    const [second] = await scanTextForSecrets({ text: value });

    expect(first?.secretKind).toBe('github-token');
    expect(first?.last4).toBe(value.slice(-4));
    expect(first?.fingerprint).toHaveLength(64);
    expect(first?.fingerprint).toBe(second?.fingerprint);
  });

  it('deduplicates the same secret appearing twice in the same text', async () => {
    const value = `ghp_${'a'.repeat(36)}`;
    const findings = await scanTextForSecrets({ text: `${value} and again ${value}` });

    expect(findings).toHaveLength(1);
  });

  it('finds nothing in plain text', async () => {
    expect(await scanTextForSecrets({ text: 'deploy the ledger service to prod' })).toEqual([]);
  });
});
