import {
  isSlotKey,
  PREAMBLE_SLOT_TOTAL_BUDGET,
  serializeSlotsBudgeted,
  SLOT_KEYS,
  SLOT_LABELS,
  type SlotKey,
} from '@goodboy/core/context';
import type { AgentRole, ContextSlot } from '@goodboy/types';
import { ROLE_SLOTS } from '../../../context/slotRouting';
import { estimateTokens } from '../../../../shared/utils/estimate-tokens';
import { NAMES } from '../../../../shared/utils/names';
import { CONTEXT_SECTION_LABEL } from './contextSections';
import { rolesLabelOf, SHOWN_ROLES } from './roleVisibility';

export type SendPart = {
  readonly key: SlotKey;
  readonly label: string;
  readonly tokens: number;
  readonly isEmpty: boolean;
};

export type SendRow = {
  readonly key: string;
  readonly label: string;
  readonly parts: ReadonlyArray<SendPart>;
  readonly tokens: number;
};

export type SendModel = {
  readonly rows: ReadonlyArray<SendRow>;
  readonly budgetTokens: number;
};

type Params = {
  readonly slots: ReadonlyArray<ContextSlot>;
};

type SectionParams = {
  readonly key: SlotKey;
  readonly slot: ContextSlot;
};

type PartParams = {
  readonly key: SlotKey;
  readonly slot: ContextSlot | undefined;
};

type RoleGroup = {
  readonly keys: ReadonlyArray<SlotKey>;
  readonly roles: Array<AgentRole>;
};

const PART_LABEL: Readonly<Record<SlotKey, string>> = {
  goal: NAMES.goal,
  decisions: NAMES.decisions,
  open_questions: 'Open questions',
  files_touched: 'Files touched',
  last_output_summary: CONTEXT_SECTION_LABEL.summary,
};

const EMPTY_RENDERED = serializeSlotsBudgeted({ slots: [] });

const BUDGET_TOKENS = estimateTokens(' '.repeat(PREAMBLE_SLOT_TOTAL_BUDGET));

const sectionTextOf = ({ key, slot }: SectionParams): string => {
  const emptySection = `## ${SLOT_LABELS[key]}\n·`;
  const start = EMPTY_RENDERED.indexOf(emptySection);
  const tailLength = EMPTY_RENDERED.length - start - emptySection.length;
  const isolated = serializeSlotsBudgeted({ slots: [slot] });
  return isolated.slice(start, isolated.length - tailLength);
};

const sendPartOf = ({ key, slot }: PartParams): SendPart => {
  if (slot === undefined || slot.value.trim() === '') {
    return { key, label: PART_LABEL[key], tokens: 0, isEmpty: true };
  }
  return {
    key,
    label: PART_LABEL[key],
    tokens: estimateTokens(sectionTextOf({ key, slot })),
    isEmpty: false,
  };
};

export const sendRowsOf = ({ slots }: Params): SendModel => {
  const sent = slots.filter((slot) => slot.enabled !== false && isSlotKey(slot.key));
  const byKey = new Map(sent.map((slot) => [slot.key, slot]));
  const groups = new Map<string, RoleGroup>();
  for (const role of SHOWN_ROLES) {
    const keys = SLOT_KEYS.filter((key) => ROLE_SLOTS[role].includes(key));
    const id = keys.join('|');
    const group = groups.get(id) ?? { keys, roles: [] };
    group.roles.push(role);
    groups.set(id, group);
  }
  const rows = [...groups.values()].map(({ keys, roles }): SendRow => {
    const routed = sent.filter((slot) => isSlotKey(slot.key) && keys.includes(slot.key));
    const rendered = routed.length > 0 ? serializeSlotsBudgeted({ slots: routed }) : '';
    return {
      key: roles.join('|'),
      label: rolesLabelOf({ roles }),
      parts: keys.map((key) => sendPartOf({ key, slot: byKey.get(key) })),
      tokens: estimateTokens(rendered),
    };
  });
  return { rows, budgetTokens: BUDGET_TOKENS };
};
