type Params = {
  readonly premiumRequests: number | null;
};

export const premiumRequestsLabelOf = ({ premiumRequests }: Params): string | null =>
  premiumRequests === null
    ? null
    : `${premiumRequests} premium ${premiumRequests === 1 ? 'request' : 'requests'}`;
