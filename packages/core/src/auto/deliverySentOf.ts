import type { LeadDeliveryPart, LeadDeliverySent } from './leadDeliveryPart';

type DeliverySentParams = {
  readonly parts: ReadonlyArray<LeadDeliveryPart>;
};

export const deliverySentOf = ({ parts }: DeliverySentParams): LeadDeliverySent =>
  new Map(parts.filter((part) => part.kind !== 'news').map((part) => [part.name, part.text]));
