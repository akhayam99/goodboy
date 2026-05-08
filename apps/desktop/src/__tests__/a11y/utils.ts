// @vitest-environment happy-dom

// axe-core license: MPL-2.0. Used as devDependency only (never distributed).
// MPL-2.0 is file-level copyleft — modifications to axe-core source must be
// shared; consuming it as a library (test runner only) imposes no obligation.
import axe from 'axe-core';

export interface A11yResult {
  violations: axe.Result[];
  passes: axe.Result[];
  incomplete: axe.Result[];
}

export async function runA11yCheck(container: Element): Promise<A11yResult> {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] },
  });
  return {
    violations: results.violations,
    passes: results.passes,
    incomplete: results.incomplete,
  };
}
