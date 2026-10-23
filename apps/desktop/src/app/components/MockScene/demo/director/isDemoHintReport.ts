import type { DemoHintReport } from './demoProtocol';
import { isDemoEnvelope } from './isDemoEnvelope';
import { isHintId } from './isHintId';

const LIMIT = 100000;

type FieldParams = {
  readonly data: object;
  readonly field: string;
};

const isCoordinate = ({ data, field }: FieldParams): boolean => {
  const value: unknown = Reflect.get(data, field);
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= LIMIT;
};

const isLength = ({ data, field }: FieldParams): boolean => {
  const value: unknown = Reflect.get(data, field);
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= LIMIT;
};

const isRect = (value: unknown): boolean => {
  if (value === null) {
    return true;
  }
  if (typeof value !== 'object') {
    return false;
  }
  return (
    isCoordinate({ data: value, field: 'x' }) &&
    isCoordinate({ data: value, field: 'y' }) &&
    isLength({ data: value, field: 'width' }) &&
    isLength({ data: value, field: 'height' })
  );
};

export const isDemoHintReport = (data: unknown): data is DemoHintReport => {
  if (!isDemoEnvelope(data)) {
    return false;
  }
  const hintId: unknown = Reflect.get(data, 'hintId');
  if (data.type === 'tried') {
    return isHintId(hintId);
  }
  if (data.type === 'place') {
    return isHintId(Reflect.get(data, 'place'));
  }
  if (data.type !== 'anchor') {
    return false;
  }
  return (
    (hintId === null || isHintId(hintId)) &&
    isRect(Reflect.get(data, 'rect')) &&
    typeof Reflect.get(data, 'isOffscreen') === 'boolean'
  );
};
