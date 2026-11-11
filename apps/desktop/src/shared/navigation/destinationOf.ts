import { DESTINATIONS, type Destination, type DestinationId } from './destinations';

type Params = {
  readonly id: DestinationId;
};

export const destinationOf = ({ id }: Params): Destination => {
  const destination = DESTINATIONS.find((candidate) => candidate.id === id);
  if (destination === undefined) {
    throw new Error(`unknown destination ${id}`);
  }
  return destination;
};
