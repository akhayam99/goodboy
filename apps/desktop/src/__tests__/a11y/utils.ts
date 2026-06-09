// @vitest-environment happy-dom

import axe from 'axe-core';

export type A11yResult = {
  violations: axe.Result[];
  passes: axe.Result[];
  incomplete: axe.Result[];
};

export const runA11yCheck = async (container: Element): Promise<A11yResult> => {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] },
  });
  return {
    violations: results.violations,
    passes: results.passes,
    incomplete: results.incomplete,
  };
};
