import type { BootMarkName } from './bootMarkNames';

export type BootMark = {
  readonly name: BootMarkName;
  readonly ms: number;
};

type Params = {
  readonly marks: ReadonlyArray<BootMark>;
};

export const formatBootReport = ({ marks }: Params): string =>
  marks.map(({ name, ms }) => `${name}=${Math.max(0, Math.round(ms))}`).join(',');
