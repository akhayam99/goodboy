import { describe, expect, it } from 'vitest';
import { PANE_RHYTHM } from '../paneRhythm';

describe('PANE_RHYTHM', () => {
  it('keeps shared pane insets aligned', () => {
    expect(PANE_RHYTHM.header).toContain(PANE_RHYTHM.inset);
    expect(PANE_RHYTHM.body).toContain(PANE_RHYTHM.inset);
    expect(PANE_RHYTHM.dock).toContain(PANE_RHYTHM.inset);
    expect(PANE_RHYTHM.detail.band).toContain(PANE_RHYTHM.inset);
    expect(PANE_RHYTHM.detail.body).toContain(PANE_RHYTHM.inset);
  });

  it('keeps the detail band shorter than the pane header it replaces', () => {
    expect(PANE_RHYTHM.detail.band).toBe('px-6 py-2');
    expect(PANE_RHYTHM.header).toBe('px-6 py-5');
  });

  it('holds one prose measure and one hero measure, and leaves the page column to PageColumn', () => {
    expect(Object.keys(PANE_RHYTHM)).not.toContain('column');
    expect(PANE_RHYTHM.prose).toBe('max-w-[var(--measure)]');
    expect(PANE_RHYTHM.hero).toBe('max-w-[640px]');
    expect(Object.keys(PANE_RHYTHM)).not.toContain('measure');
  });

  it('puts a header that reads as a section one stack gap above the body', () => {
    const stackGap = PANE_RHYTHM.stack.split(' ').find((entry) => entry.startsWith('gap-'));
    expect(PANE_RHYTHM.below.section.replace('pb-', 'gap-')).toBe(stackGap);
    expect(PANE_RHYTHM.below.title).toBe('pb-4');
  });

  describe('the Sessions block in the column', () => {
    const pxOf = ({ classes, prefix }: { readonly classes: string; readonly prefix: string }) => {
      const found = classes.split(' ').find((entry) => entry.startsWith(`${prefix}-`));
      return found === undefined ? 0 : Number(found.slice(prefix.length + 1)) * 4;
    };

    it('puts the eyebrow, the door icons and the row icons on one left edge', () => {
      const eyebrow = pxOf({ classes: PANE_RHYTHM.sessionList.headerInset, prefix: 'pl' });
      const rowIcon =
        pxOf({ classes: PANE_RHYTHM.sessionList.pad, prefix: 'px' }) +
        pxOf({ classes: PANE_RHYTHM.sessionList.rowInset, prefix: 'px' });
      const doorIcon =
        pxOf({ classes: PANE_RHYTHM.navRail.inset, prefix: 'px' }) +
        pxOf({ classes: PANE_RHYTHM.navRail.door, prefix: 'px' });

      expect(eyebrow).toBe(16);
      expect(rowIcon).toBe(eyebrow);
      expect(doorIcon).toBe(eyebrow);
    });

    it('uses one vertical gap for the doors and the session rows', () => {
      expect(PANE_RHYTHM.sessionList.rowGap).toBe(PANE_RHYTHM.navRail.doorGap);
    });

    it('gives the view menu a 28px target, as tall as a door and a row', () => {
      expect(PANE_RHYTHM.sessionList.menuTrigger).toBe('size-7');
      expect(PANE_RHYTHM.navRail.door).toContain('h-7');
    });
  });
});
