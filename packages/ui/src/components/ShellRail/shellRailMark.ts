export type ShellRailMark =
  | {
      readonly kind: 'count';
      readonly count: number;
      readonly name: string;
    }
  | {
      readonly kind: 'dot';
      readonly name: string;
    }
  | {
      readonly kind: 'ring';
      readonly percent: number | null;
      readonly name: string;
    };
