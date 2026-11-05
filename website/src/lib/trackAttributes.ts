export type TrackAttributes = Readonly<Record<string, string>>;

type Params = {
  readonly event: string;
  readonly params: Readonly<Record<string, string>>;
};

export const trackAttributes = ({ event, params }: Params): TrackAttributes => ({
  'data-track': event,
  ...Object.fromEntries(
    Object.entries(params).map(([name, value]) => [`data-track-${name.replace(/_/g, '-')}`, value]),
  ),
});
