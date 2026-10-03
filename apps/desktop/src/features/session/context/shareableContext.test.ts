// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CONTEXT_ORDER, shareableContext } from './shareableContext';
import { CONTEXT_TABS, CONTEXT_TAB_LABEL } from '../components/ContextDrawer/contextTabs';

describe('shareableContext', () => {
  it('writes Goal, Decisions, Summary and Open questions in that order', () => {
    const brief = shareableContext({
      goal: 'Stop crediting an invoice twice.',
      decisions: '- D1 Key redeliveries by event id',
      summary: '#### State\n- fix merged',
      openQuestions: ['Backfill the old credits?'],
    });

    expect(brief).toBe(
      [
        '## Goal\n\nStop crediting an invoice twice.',
        '## Decisions\n\n- D1 Key redeliveries by event id',
        '## Summary\n\n#### State\n- fix merged',
        '## Open questions\n\n- Backfill the old credits?',
      ].join('\n\n'),
    );
  });

  it('leaves out what is empty', () => {
    expect(
      shareableContext({ goal: 'Ship it', decisions: '  ', summary: '', openQuestions: [] }),
    ).toBe('## Goal\n\nShip it');
  });

  it('follows the order of the drawer tabs that agents read, leaving Learned out', () => {
    const slotTabs = CONTEXT_TABS.filter((tab) => tab !== 'learned');
    expect(slotTabs.map((tab) => CONTEXT_TAB_LABEL[tab])).toEqual(
      CONTEXT_ORDER.slice(0, slotTabs.length),
    );
  });
});
