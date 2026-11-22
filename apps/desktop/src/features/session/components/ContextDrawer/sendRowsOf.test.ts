// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AUTO_BRIEF_VERSION } from '@goodboy/core/auto';
import { SLOT_BUDGETS, SLOT_KEYS } from '@goodboy/core/context';
import type { ContextSlot } from '@goodboy/types';
import { briefSlotsOf } from '../../../../store/slices/turn/briefSlotsOf';
import { buildContextPreamble } from '../../../../store/slices/turn/preamble';
import { estimateTokens } from '../../../../shared/utils/estimate-tokens';
import { ROLE_SLOTS } from '../../../context/slotRouting';
import { ROLE_LABEL } from '../../agent-kind';
import { sendRowsOf, type SendRow } from './sendRowsOf';

const FULL_SLOTS: ReadonlyArray<ContextSlot> = SLOT_KEYS.map((key) => ({
  key,
  value: `${key} for the Harborline retry queue`,
  enabled: true,
}));

type RowParams = {
  readonly rows: ReadonlyArray<SendRow>;
  readonly label: string;
};

const rowOf = ({ rows, label }: RowParams): SendRow => {
  const row = rows.find((candidate) => candidate.label === label);
  if (row === undefined) {
    throw new Error(`No row ${label}`);
  }
  return row;
};

describe('sendRowsOf', () => {
  it('groups the roles that receive the same parts, each with its parts', () => {
    const { rows } = sendRowsOf({ slots: FULL_SLOTS });

    expect(rows.map((row) => [row.label, row.parts.map((part) => part.key)])).toEqual([
      [ROLE_LABEL.planner, ['goal', 'decisions', 'open_questions', 'last_output_summary']],
      [
        [ROLE_LABEL.implementer, ROLE_LABEL.investigator, ROLE_LABEL.reviewer].join(', '),
        ['goal', 'files_touched', 'decisions', 'last_output_summary'],
      ],
      [[ROLE_LABEL.scout, ROLE_LABEL.docs].join(', '), ['goal', 'last_output_summary']],
      [ROLE_LABEL.resolver, ['goal', 'files_touched', 'decisions']],
      [
        `${[ROLE_LABEL.custom, ROLE_LABEL.tester, ROLE_LABEL.report].join(', ')} +3`,
        [...SLOT_KEYS],
      ],
    ]);
  });

  it('gives Lead children only the slots their brief keeps', () => {
    const { rows, leadChild } = sendRowsOf({ slots: FULL_SLOTS });
    const brief = briefSlotsOf({
      input: { origin: 'delegation', briefVersion: AUTO_BRIEF_VERSION },
      confinedRole: 'implementer',
      childTurn: null,
      slots: ROLE_SLOTS.implementer,
    });
    const implementer = rowOf({
      rows,
      label: [ROLE_LABEL.implementer, ROLE_LABEL.investigator, ROLE_LABEL.reviewer].join(', '),
    });

    expect(leadChild.parts.map((part) => part.key)).toEqual(brief);
    expect(leadChild.tokens).toBeGreaterThan(0);
    expect(leadChild.tokens).toBeLessThan(implementer.tokens);
  });

  it('weighs each role by the shared context its preamble carries', () => {
    const { rows } = sendRowsOf({ slots: FULL_SLOTS });
    const scout = rowOf({ rows, label: [ROLE_LABEL.scout, ROLE_LABEL.docs].join(', ') });
    const preamble = buildContextPreamble(FULL_SLOTS, ROLE_SLOTS.scout);

    expect(scout.tokens).toBeGreaterThan(0);
    expect(estimateTokens(preamble)).toBeGreaterThan(scout.tokens);
    expect(scout.parts.every((part) => part.tokens > 0 && !part.isEmpty)).toBe(true);
    expect(scout.parts.reduce((sum, part) => sum + part.tokens, 0)).toBeLessThanOrEqual(
      scout.tokens,
    );
  });

  it('caps a long part at its own budget', () => {
    const long = FULL_SLOTS.map((slot) =>
      slot.key === 'decisions' ? { ...slot, value: 'Keep the retry queue.\n'.repeat(400) } : slot,
    );
    const planner = rowOf({ rows: sendRowsOf({ slots: long }).rows, label: ROLE_LABEL.planner });
    const decisions = planner.parts.find((part) => part.key === 'decisions');

    expect(decisions?.tokens).toBeLessThanOrEqual(
      estimateTokens(' '.repeat(SLOT_BUDGETS.decisions + 20)),
    );
  });

  it('shows an empty or switched off part without a weight', () => {
    const slots = FULL_SLOTS.flatMap((slot) => {
      if (slot.key === 'goal') {
        return [{ ...slot, value: '  ' }];
      }
      if (slot.key === 'last_output_summary') {
        return [{ ...slot, enabled: false }];
      }
      return [slot];
    });
    const planner = rowOf({ rows: sendRowsOf({ slots }).rows, label: ROLE_LABEL.planner });

    expect(planner.parts.filter((part) => part.isEmpty).map((part) => part.key)).toEqual([
      'goal',
      'last_output_summary',
    ]);
    expect(planner.parts.filter((part) => part.isEmpty).every((part) => part.tokens === 0)).toBe(
      true,
    );
  });

  it('sends nothing to a role whose parts are all empty', () => {
    const { rows } = sendRowsOf({ slots: [] });

    expect(rows.every((row) => row.tokens === 0)).toBe(true);
  });

  it('states the preamble budget in tokens', () => {
    expect(sendRowsOf({ slots: FULL_SLOTS }).budgetTokens).toBe(1_525);
  });
});
