import type { DemoCommand, DemoCommandType } from './demoProtocol';
import { isDemoEnvelope } from './isDemoEnvelope';

const COMMAND_TYPES: ReadonlySet<unknown> = new Set<DemoCommandType>(['play', 'pause', 'restart']);

export const isDemoCommand = (data: unknown): data is DemoCommand =>
  isDemoEnvelope(data) && COMMAND_TYPES.has(data.type);
