// @vitest-environment happy-dom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DockToolRow } from '../components/DockToolRow';
import { DrawerFrame } from '../components/DrawerFrame';

afterEach(cleanup);

describe('the tool row of a dock panel', () => {
  it('holds the scope, the tabs and the actions in one 36px row', () => {
    render(
      <DockToolRow scope={<button type="button">Harborline</button>} actions={<i>actions</i>}>
        <span>tabs</span>
      </DockToolRow>,
    );

    const row = document.querySelector<HTMLElement>('[data-dock-tool-row]');
    expect(row?.className).toContain('h-9');
    expect(within(row as HTMLElement).getAllByText(/Harborline|tabs|actions/)).toHaveLength(3);
  });

  it('puts the meta of a dock panel in its head and the toolbar in one row, never a second line', () => {
    render(
      <DrawerFrame
        isDock
        title="Monitor"
        meta="14 of 20 ports"
        toolbar={<DockToolRow>search</DockToolRow>}
        onClose={() => undefined}
        scroll="self"
      >
        body
      </DrawerFrame>,
    );

    expect(document.querySelector('[data-drawer-meta]')).toBeNull();
    expect(
      document.querySelector('[data-dock-panel-head]')?.textContent?.includes('14 of 20 ports'),
    ).toBe(true);
    expect(document.querySelectorAll('[data-dock-tool-row]')).toHaveLength(1);
    screen.getByText('search');
  });
});
