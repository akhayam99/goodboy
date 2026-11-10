// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { typedLocalPathOf } from './typedLocalPathOf';

describe('typedLocalPathOf', () => {
  it('offers a page, an image or a pdf typed as a path', () => {
    expect(typedLocalPathOf({ text: '~/harborline/plan.html' })).toBe('~/harborline/plan.html');
    expect(typedLocalPathOf({ text: '/work/acme/shot.PNG' })).toBe('/work/acme/shot.PNG');
    expect(typedLocalPathOf({ text: 'file:///work/acme/spec.pdf' })).toBe(
      'file:///work/acme/spec.pdf',
    );
  });

  it('leaves a folder, a source file and a bare name to the search', () => {
    expect(typedLocalPathOf({ text: '/work/harborline' })).toBeNull();
    expect(typedLocalPathOf({ text: '~/ledger-core/src/main.ts' })).toBeNull();
    expect(typedLocalPathOf({ text: 'plan.html' })).toBeNull();
    expect(typedLocalPathOf({ text: 'https://acme.example/plan.html' })).toBeNull();
  });
});
