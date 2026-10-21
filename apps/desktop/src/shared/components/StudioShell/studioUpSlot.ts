type Claim = {
  readonly up: () => (() => void) | null;
};

type ClaimParams = Claim;

const claims: Array<Claim> = [];

export const studioUpSlot = {
  claim: ({ up }: ClaimParams): (() => void) => {
    const claim: Claim = { up };
    claims.push(claim);
    return () => {
      const index = claims.indexOf(claim);
      if (index === -1) {
        return;
      }
      claims.splice(index, 1);
    };
  },
  current: (): (() => void) | null => claims.at(-1)?.up() ?? null,
};
