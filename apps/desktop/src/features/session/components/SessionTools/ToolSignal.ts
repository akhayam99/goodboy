export type ToolSignal = {
  readonly kind: 'changed' | 'running' | 'error';
  readonly note: string;
};
