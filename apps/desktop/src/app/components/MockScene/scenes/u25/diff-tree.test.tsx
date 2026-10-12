// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { U25_DIFF_TREE_SCENES } from './diff-tree';

afterEach(cleanup);

describe('the diff tree scene', () => {
  it('shows nested folders and files with no guide lines', () => {
    installFakeResizeObserver();
    const Scene = U25_DIFF_TREE_SCENES['diff-tree-indent'];
    render(<Scene />);

    const writer = screen.getByRole('treeitem', { name: /writer\.ts/ });
    expect(writer.getAttribute('aria-level')).toBe('5');
    expect(screen.getAllByRole('treeitem').length).toBeGreaterThan(5);
    expect(document.querySelectorAll('[role="treeitem"] i')).toHaveLength(0);
  });
});
