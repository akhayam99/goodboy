import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { parseWorkDrafter, serializeWorkDrafter, workDrafterSettingKey } from './workDrafter';

describe('work drafter setting', () => {
  it('keeps one key per workspace', () => {
    expect(workDrafterSettingKey({ workspaceId: 'ws-harborline' as WorkspaceId })).toBe(
      'chat.workDrafter.ws-harborline',
    );
    expect(workDrafterSettingKey({ workspaceId: 'ws-northwind' as WorkspaceId })).not.toBe(
      workDrafterSettingKey({ workspaceId: 'ws-harborline' as WorkspaceId }),
    );
  });

  it('reads back what it wrote', () => {
    const choice = { provider: 'anthropic', model: 'sonnet-5' } as const;

    expect(parseWorkDrafter({ raw: serializeWorkDrafter({ choice }) })).toEqual(choice);
  });

  it('ignores a missing, broken or unusable value', () => {
    expect(parseWorkDrafter({ raw: null })).toBeNull();
    expect(parseWorkDrafter({ raw: '' })).toBeNull();
    expect(parseWorkDrafter({ raw: 'not json' })).toBeNull();
    expect(
      parseWorkDrafter({ raw: '{"provider":"anthropic","model":"retired-model"}' }),
    ).toBeNull();
    expect(parseWorkDrafter({ raw: '{"provider":"cursor","model":"auto"}' })).toBeNull();
    expect(parseWorkDrafter({ raw: '{"provider":"anthropic"}' })).toBeNull();
    expect(parseWorkDrafter({ raw: '[]' })).toBeNull();
  });
});
