import type { DemoReport, DemoReportType } from './demoProtocol';
import { readDemoEnvelope } from './readDemoEnvelope';

const REPORT_TYPES: ReadonlyArray<DemoReportType> = ['ready', 'progress', 'complete', 'hint'];

type Params = {
  readonly data: unknown;
};

type FieldParams = {
  readonly data: object;
  readonly field: string;
};

const countOf = ({ data, field }: FieldParams): number | null => {
  const value: unknown = Reflect.get(data, field);
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
};

export const readDemoReport = ({ data }: Params): DemoReport | null => {
  const envelope = readDemoEnvelope({ data });
  const type = REPORT_TYPES.find((candidate) => candidate === envelope?.type);
  if (envelope === null || type === undefined) {
    return null;
  }
  const elapsedMs = countOf({ data: envelope.data, field: 'elapsedMs' });
  const durationMs = countOf({ data: envelope.data, field: 'durationMs' });
  const cueIndex = countOf({ data: envelope.data, field: 'cueIndex' });
  const hint: unknown = Reflect.get(envelope.data, 'hint');
  if (elapsedMs === null || durationMs === null || cueIndex === null) {
    return null;
  }
  if (hint !== undefined && typeof hint !== 'string') {
    return null;
  }
  return {
    channel: envelope.channel,
    version: envelope.version,
    generation: envelope.generation,
    type,
    elapsedMs,
    durationMs,
    cueIndex,
    ...(hint === undefined ? {} : { hint }),
  };
};
