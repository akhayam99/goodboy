import { listContextSlotsForTask, upsertContextSlot, type Database } from '@kay-am/db';
import type { ContextSlot, TaskId } from '@kay-am/types';
import { assertSlotKey, serializeSlots, SLOT_KEYS, type SlotKey } from './slots';

export interface ContextEngineDeps {
  readonly db: Database;
}

export class ContextEngine {
  constructor(private readonly deps: ContextEngineDeps) {}

  load(taskId: TaskId): Promise<ReadonlyArray<ContextSlot>> {
    return listContextSlotsForTask(this.deps.db, taskId);
  }

  async upsert(taskId: TaskId, key: string, value: string): Promise<void> {
    assertSlotKey(key);
    await upsertContextSlot(this.deps.db, taskId, {
      key,
      value,
      enabled: true,
    });
  }

  async setEnabled(taskId: TaskId, key: SlotKey, enabled: boolean): Promise<void> {
    const existing = await this.load(taskId);
    const slot = existing.find((s) => s.key === key);
    await upsertContextSlot(this.deps.db, taskId, {
      key,
      value: slot?.value ?? '',
      enabled,
    });
  }

  async serialize(taskId: TaskId): Promise<string> {
    const slots = await this.load(taskId);
    return serializeSlots(slots);
  }

  static get keys(): ReadonlyArray<SlotKey> {
    return SLOT_KEYS;
  }
}
