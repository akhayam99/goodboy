import type { DemoHintsCommand } from './demoProtocol';
import { isDemoEnvelope } from './isDemoEnvelope';
import { isHintId } from './isHintId';

const MAX_SETTLED = 64;

const isSettledList = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.length <= MAX_SETTLED && value.every((entry) => isHintId(entry));

export const isDemoHintsCommand = (data: unknown): data is DemoHintsCommand =>
  isDemoEnvelope(data) &&
  data.type === 'hints' &&
  isHintId(Reflect.get(data, 'chapterId')) &&
  isSettledList(Reflect.get(data, 'settledIds'));
