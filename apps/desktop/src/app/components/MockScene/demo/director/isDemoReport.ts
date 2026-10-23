import type { DemoReport, DemoReportType } from './demoProtocol';
import { isDemoEnvelope } from './isDemoEnvelope';

const REPORT_TYPES: ReadonlySet<unknown> = new Set<DemoReportType>([
  'ready',
  'progress',
  'complete',
  'hint',
]);

type FieldParams = {
  readonly data: object;
  readonly field: string;
};

const isCount = ({ data, field }: FieldParams): boolean => {
  const value: unknown = Reflect.get(data, field);
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
};

export const isDemoReport = (data: unknown): data is DemoReport =>
  isDemoEnvelope(data) &&
  REPORT_TYPES.has(data.type) &&
  isCount({ data, field: 'elapsedMs' }) &&
  isCount({ data, field: 'durationMs' }) &&
  isCount({ data, field: 'cueIndex' }) &&
  ['string', 'undefined'].includes(typeof Reflect.get(data, 'hint'));
