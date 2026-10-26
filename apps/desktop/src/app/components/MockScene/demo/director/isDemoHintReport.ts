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

type ValueParams = {
  readonly value: unknown;
};

const isRect = ({ value }: ValueParams): boolean => {
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

const MAX_OPENED = 16;

const isRectList = ({ value }: ValueParams): boolean =>
  Array.isArray(value) &&
  value.length <= MAX_OPENED &&
  value.every((entry: unknown) => entry !== null && isRect({ value: entry }));

export const isDemoHintReport = (data: unknown): data is DemoHintReport => {
  if (!isDemoEnvelope(data)) {
    return false;
  }
  const hintId: unknown = Reflect.get(data, 'hintId');
  if (data.type === 'tried') {
    return isHintId(hintId);
  }
  if (data.type !== 'anchor') {
    return false;
  }
  const isClicked: unknown = Reflect.get(data, 'isClicked');
  const isPressed: unknown = Reflect.get(data, 'isPressed');
  return (
    (hintId === null || isHintId(hintId)) &&
    isRect({ value: Reflect.get(data, 'rect') }) &&
    (!Reflect.has(data, 'focus') || isRect({ value: Reflect.get(data, 'focus') })) &&
    (!Reflect.has(data, 'opened') || isRectList({ value: Reflect.get(data, 'opened') })) &&
    typeof Reflect.get(data, 'isOffscreen') === 'boolean' &&
    (isClicked === undefined || typeof isClicked === 'boolean') &&
    (isPressed === undefined || typeof isPressed === 'boolean')
  );
};
