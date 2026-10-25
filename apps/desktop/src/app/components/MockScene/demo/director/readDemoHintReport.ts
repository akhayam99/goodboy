import type { DemoHintReport, DemoRect } from './demoProtocol';
import { readDemoEnvelope } from './readDemoEnvelope';
import { readHintId } from './readHintId';

const LIMIT = 100000;

type Params = {
  readonly data: unknown;
};

type FieldParams = {
  readonly data: object;
  readonly field: string;
};

type ValueParams = {
  readonly value: unknown;
};

const coordinateOf = ({ data, field }: FieldParams): number | null => {
  const value: unknown = Reflect.get(data, field);
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= LIMIT
    ? value
    : null;
};

const lengthOf = ({ data, field }: FieldParams): number | null => {
  const value: unknown = Reflect.get(data, field);
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= LIMIT
    ? value
    : null;
};

const rectOf = ({ value }: ValueParams): DemoRect | null | undefined => {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'object') {
    return undefined;
  }
  const x = coordinateOf({ data: value, field: 'x' });
  const y = coordinateOf({ data: value, field: 'y' });
  const width = lengthOf({ data: value, field: 'width' });
  const height = lengthOf({ data: value, field: 'height' });
  return x === null || y === null || width === null || height === null
    ? undefined
    : { x, y, width, height };
};

export const readDemoHintReport = ({ data }: Params): DemoHintReport | null => {
  const envelope = readDemoEnvelope({ data });
  if (envelope === null) {
    return null;
  }
  const base = {
    channel: envelope.channel,
    version: envelope.version,
    generation: envelope.generation,
  };
  const hintValue: unknown = Reflect.get(envelope.data, 'hintId');
  const hintId = readHintId({ value: hintValue });
  if (envelope.type === 'tried') {
    return hintId === null ? null : { ...base, type: 'tried', hintId };
  }
  if (envelope.type === 'place') {
    const place = readHintId({ value: Reflect.get(envelope.data, 'place') });
    return place === null ? null : { ...base, type: 'place', place };
  }
  if (envelope.type !== 'anchor') {
    return null;
  }
  const rect = rectOf({ value: Reflect.get(envelope.data, 'rect') });
  const isOffscreen: unknown = Reflect.get(envelope.data, 'isOffscreen');
  const hasValidHint = hintValue === null || hintId !== null;
  if (!hasValidHint || rect === undefined || typeof isOffscreen !== 'boolean') {
    return null;
  }
  return { ...base, type: 'anchor', hintId, rect, isOffscreen };
};
