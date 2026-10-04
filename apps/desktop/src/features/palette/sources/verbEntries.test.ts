// @vitest-environment node
import { Square } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { NAMES } from '../../../shared/names';
import type { ResolvedAction, SessionsActionTarget } from '../../actions/types';
import { verbEntries } from './verbEntries';

const target: SessionsActionTarget = { kind: 'sessions', sessionIds: [] };

const action = (label: string): ResolvedAction => ({
  id: 'workflowRun.close',
  label,
  shortLabel: label,
  icon: Square,
  group: 'danger',
  slot: 'menu',
  pendingLabel: null,
  shortcut: null,
  description: null,
  blockedReason: null,
  confirm: null,
  isUndoable: false,
  choices: null,
  isBusy: false,
});

describe('verbEntries', () => {
  it('lets the former name of a renamed verb find the new one', () => {
    const [entry] = verbEntries({
      target,
      actions: [action(NAMES.stopWorkflow)],
      isScope: false,
      noun: 'workflow',
      select: () => undefined,
    });
    expect(entry?.label).toBe('Stop workflow');
    expect(entry?.secondary).toEqual(['workflow', 'Close workflow']);
  });

  it('adds nothing for a verb that kept its name', () => {
    const [entry] = verbEntries({
      target,
      actions: [action('Delete workflow run')],
      isScope: false,
      noun: 'workflow',
      select: () => undefined,
    });
    expect(entry?.secondary).toEqual(['workflow']);
  });
});
