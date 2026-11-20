type RetiredName = {
  readonly id: string;
  readonly pattern: RegExp;
  readonly use: string;
};

export const RETIRED_NAMES: ReadonlyArray<RetiredName> = [
  {
    id: 'typed-requests',
    pattern: /\bTyped requests\b/i,
    use: 'nothing: the Lead starts on the request as typed',
  },
];
