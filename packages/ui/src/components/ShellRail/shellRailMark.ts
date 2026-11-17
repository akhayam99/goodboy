export type ShellRailMark =
  | {
      readonly kind: 'count';
      readonly count: number;
      readonly name: string;
    }
  | {
      readonly kind: 'dot';
      readonly name: string;
    };
