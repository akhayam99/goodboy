import type { DemoRevealCommand } from './demoProtocol';
import { isDemoEnvelope } from './isDemoEnvelope';
import { isHintId } from './isHintId';

export const isDemoRevealCommand = (data: unknown): data is DemoRevealCommand =>
  isDemoEnvelope(data) && data.type === 'reveal' && isHintId(Reflect.get(data, 'hintId'));
