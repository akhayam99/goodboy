// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { titleReplyRulesOf } from './titleReplyRules';

describe('titleReplyRulesOf', () => {
  it('follows the language of the request on Auto', () => {
    expect(titleReplyRulesOf({ preferred: null })).toContain('in the language of the request');
  });

  it('asks for Italian whatever language the request is in', () => {
    const rules = titleReplyRulesOf({ preferred: 'it' });

    expect(rules).toContain('written in Italian whatever language the request is in');
    expect(rules).not.toContain('in the language of the request');
  });
});
