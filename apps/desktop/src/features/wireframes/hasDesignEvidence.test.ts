import { describe, expect, it } from 'vitest';
import type { DesignProfile } from './collectDesignProfile';
import { hasDesignEvidence } from './hasDesignEvidence';

const walked = (overrides: Partial<DesignProfile> = {}): DesignProfile => ({
  themeName: 'generic',
  commitSha: 'abc1234',
  tailwind: null,
  tokens: [],
  variants: [],
  layoutExamples: [],
  notes: ['no tailwind config was found'],
  ...overrides,
});

describe('hasDesignEvidence', () => {
  it('reports nothing found when the walk came back empty', () => {
    expect(hasDesignEvidence({ profile: walked() })).toBe(false);
  });

  it('reports a tailwind config as evidence', () => {
    expect(
      hasDesignEvidence({
        profile: walked({ tailwind: { path: 'tailwind.config.ts', excerpt: 'theme' } }),
      }),
    ).toBe(true);
  });

  it('reports a token as evidence', () => {
    expect(
      hasDesignEvidence({
        profile: walked({ tokens: [{ name: 'bg', value: '#101010', path: 'src/index.css' }] }),
      }),
    ).toBe(true);
  });

  it('reports a variant group as evidence', () => {
    expect(
      hasDesignEvidence({
        profile: walked({
          variants: [{ path: 'src/Button.tsx', component: 'Button', variants: ['ghost'] }],
        }),
      }),
    ).toBe(true);
  });

  it('reports a layout example as evidence', () => {
    expect(
      hasDesignEvidence({
        profile: walked({ layoutExamples: [{ path: 'src/Page.tsx', excerpt: '<main>' }] }),
      }),
    ).toBe(true);
  });
});
