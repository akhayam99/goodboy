export type ToolSignal = {
  readonly kind: 'changed' | 'error';
  readonly note: string;
};
