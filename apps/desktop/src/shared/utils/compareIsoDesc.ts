type InstantParams = {
  readonly iso: string;
};

type CompareParams = {
  readonly left: string;
  readonly right: string;
};

const COMPACT_OFFSET = /([+-])(\d{2})(\d{2})$/;

export const instantOf = ({ iso }: InstantParams): number => {
  const parsed = Date.parse(iso.trim().replace(COMPACT_OFFSET, '$1$2:$3'));
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const compareIsoDesc = ({ left, right }: CompareParams): number =>
  instantOf({ iso: right }) - instantOf({ iso: left });
