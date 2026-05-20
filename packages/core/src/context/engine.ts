import { listContextSlotsForSession, upsertContextSlot, type Database } from '@goodboy/db';
import type { ContextSlot, SessionId } from '@goodboy/types';
import { assertSlotKey, serializeSlots, SLOT_KEYS, type SlotKey } from './slots';

export interface ContextEngineDeps {
  readonly db: Database;
}

export class ContextEngine {
  constructor(private readonly deps: ContextEngineDeps) {}

  load(sessionId: SessionId): Promise<ReadonlyArray<ContextSlot>> {
    return listContextSlotsForSession(this.deps.db, sessionId);
  }

  async upsert(sessionId: SessionId, key: string, value: string): Promise<void> {
    assertSlotKey(key);
    await upsertContextSlot(this.deps.db, sessionId, {
      key,
      value,
      enabled: true,
    });
  }

  async setEnabled(sessionId: SessionId, key: SlotKey, enabled: boolean): Promise<void> {
    const existing = await this.load(sessionId);
    const slot = existing.find((s) => s.key === key);
    await upsertContextSlot(this.deps.db, sessionId, {
      key,
      value: slot?.value ?? '',
      enabled,
    });
  }

  async serialize(sessionId: SessionId): Promise<string> {
    const slots = await this.load(sessionId);
    return serializeSlots(slots);
  }

  static get keys(): ReadonlyArray<SlotKey> {
    return SLOT_KEYS;
  }
}
