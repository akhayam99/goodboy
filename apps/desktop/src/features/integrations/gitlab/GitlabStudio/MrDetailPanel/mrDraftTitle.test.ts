import { describe, expect, it } from 'vitest';
import { mrDraftTitle, stripDraftPrefix } from './mrDraftTitle';

describe('mrDraftTitle', () => {
  it('prefixes a ready title when moving to draft', () => {
    expect(mrDraftTitle({ title: 'Ship the inbox', isDraft: true })).toBe('Draft: Ship the inbox');
  });

  it('does not stack a second prefix on an already drafted title', () => {
    expect(mrDraftTitle({ title: 'Draft: Ship the inbox', isDraft: true })).toBe(
      'Draft: Ship the inbox',
    );
  });

  it('strips every prefix GitLab accepts when marking ready', () => {
    expect(mrDraftTitle({ title: 'Draft: Ship it', isDraft: false })).toBe('Ship it');
    expect(mrDraftTitle({ title: '[Draft] Ship it', isDraft: false })).toBe('Ship it');
    expect(mrDraftTitle({ title: '(Draft) Ship it', isDraft: false })).toBe('Ship it');
    expect(mrDraftTitle({ title: 'WIP: Ship it', isDraft: false })).toBe('Ship it');
  });

  it('leaves a title that only starts with a similar word alone', () => {
    expect(stripDraftPrefix({ title: 'Drafting the release notes' })).toBe(
      'Drafting the release notes',
    );
  });

  it('keeps the prefix usable on an empty title', () => {
    expect(mrDraftTitle({ title: 'Draft:', isDraft: true })).toBe('Draft:');
  });
});
