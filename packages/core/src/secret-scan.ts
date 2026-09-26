import type { SecretKind } from '@goodboy/types';

type PatternRule = {
  readonly kind: SecretKind;
  readonly pattern: RegExp;
};

const PATTERN_RULES: ReadonlyArray<PatternRule> = [
  { kind: 'github-token', pattern: /\bghp_[A-Za-z0-9]{20,}\b/g },
  { kind: 'github-fine-grained-token', pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { kind: 'openai-key', pattern: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { kind: 'slack-bot-token', pattern: /\bxoxb-[A-Za-z0-9-]{10,}\b/g },
  { kind: 'slack-user-token', pattern: /\bxoxp-[A-Za-z0-9-]{10,}\b/g },
  { kind: 'linear-api-key', pattern: /\blin_api_[A-Za-z0-9]{20,}\b/g },
  { kind: 'gitlab-token', pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/g },
  { kind: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: 'private-key', pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g },
  { kind: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g },
  {
    kind: 'generic-secret',
    pattern: /\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET)\s*=\s*["']?([A-Za-z0-9\-_./+]{16,})["']?/g,
  },
];

export type SecretMatch = {
  readonly kind: SecretKind;
  readonly value: string;
};

export const findSecretMatches = ({
  text,
}: {
  readonly text: string;
}): ReadonlyArray<SecretMatch> => {
  const matches: Array<SecretMatch> = [];
  for (const rule of PATTERN_RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      const value = rule.kind === 'generic-secret' ? match[1] : match[0];
      if (value === undefined || value.length === 0) {
        continue;
      }
      matches.push({ kind: rule.kind, value });
    }
  }
  return matches;
};

const digestHex = async ({ text }: { readonly text: string }): Promise<string> => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
};

export type SecretFinding = {
  readonly secretKind: SecretKind;
  readonly fingerprint: string;
  readonly last4: string;
};

export const scanTextForSecrets = async ({
  text,
}: {
  readonly text: string;
}): Promise<ReadonlyArray<SecretFinding>> => {
  const matches = findSecretMatches({ text });
  const seen = new Set<string>();
  const findings: Array<SecretFinding> = [];
  for (const match of matches) {
    const fingerprint = await digestHex({ text: match.value });
    const key = `${match.kind}:${fingerprint}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    findings.push({
      secretKind: match.kind,
      fingerprint,
      last4: match.value.slice(-4),
    });
  }
  return findings;
};
