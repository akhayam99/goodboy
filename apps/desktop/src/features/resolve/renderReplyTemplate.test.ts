import { describe, expect, it } from 'vitest';
import { renderReplyTemplate, replyTemplateProblems } from './renderReplyTemplate';
import { REPLY_TEMPLATE_FIXED_DEFAULT, REPLY_TEMPLATE_NO_CHANGE_DEFAULT } from './replySettings';

const VARS = {
  reason: 'Attempts are now capped at 6.',
  commit: '[`4f21c8b`](https://github.com/acme/payments-api/commit/4f21c8b)',
  fixup_of: '`3a1f9c2`',
  reviewer: '@cascadia-lead',
  file: 'src/webhooks/retryPolicy.ts',
  line: '42',
};

describe('renderReplyTemplate', () => {
  it('fills the default fixed template', () => {
    expect(renderReplyTemplate({ template: REPLY_TEMPLATE_FIXED_DEFAULT, vars: VARS })).toBe(
      'Attempts are now capped at 6.\n\nFixed in [`4f21c8b`](https://github.com/acme/payments-api/commit/4f21c8b).',
    );
  });

  it('fills the default not changing template', () => {
    expect(
      renderReplyTemplate({
        template: REPLY_TEMPLATE_NO_CHANGE_DEFAULT,
        vars: { reason: 'The sibling routes use the same name.' },
      }),
    ).toBe('The sibling routes use the same name.\n\nLeaving this as is.');
  });

  it('fills every variable', () => {
    expect(
      renderReplyTemplate({
        template: '{reviewer}: {reason} {file}:{line}, {commit} fixup of {fixup_of}',
        vars: VARS,
      }),
    ).toBe(
      '@cascadia-lead: Attempts are now capped at 6. src/webhooks/retryPolicy.ts:42, [`4f21c8b`](https://github.com/acme/payments-api/commit/4f21c8b) fixup of `3a1f9c2`',
    );
  });

  it('drops the blank lines a missing value leaves behind', () => {
    expect(
      renderReplyTemplate({
        template: '{reason}\n\n{fixup_of}\n\nFixed in {commit}.',
        vars: { reason: 'Capped.', commit: 'x' },
      }),
    ).toBe('Capped.\n\nFixed in x.');
    expect(
      renderReplyTemplate({ template: '{reason}\n\nFixed in {commit}.', vars: { commit: 'x' } }),
    ).toBe('Fixed in x.');
  });

  it('leaves an unknown variable as written', () => {
    expect(renderReplyTemplate({ template: '{reason} {foo}', vars: VARS })).toBe(
      'Attempts are now capped at 6. {foo}',
    );
  });
});

describe('replyTemplateProblems', () => {
  it('accepts the defaults', () => {
    expect(replyTemplateProblems({ template: REPLY_TEMPLATE_FIXED_DEFAULT })).toEqual([]);
  });

  it('asks for {reason} and names every unknown variable once', () => {
    expect(replyTemplateProblems({ template: 'Fixed in {commit}. {foo} {foo} {sha}' })).toEqual([
      'Add {reason}, where the reply goes',
      'Unknown variable {foo}',
      'Unknown variable {sha}',
    ]);
  });
});
