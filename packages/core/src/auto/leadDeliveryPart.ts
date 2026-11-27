export type LeadDeliveryPartKind = 'news' | 'state' | 'list';

export type LeadDeliveryPart = Readonly<{
  name: string;
  kind: LeadDeliveryPartKind;
  text: string;
}>;

export type LeadDeliverySent = ReadonlyMap<string, string>;

export type LeadDeliveryBaseline = Readonly<{
  sessionId: string;
  sent: LeadDeliverySent;
}>;

type JoinPartsParams = {
  readonly parts: ReadonlyArray<LeadDeliveryPart>;
};

export const joinDeliveryParts = ({ parts }: JoinPartsParams): string =>
  parts
    .map((part) => part.text)
    .filter((text) => text !== '')
    .join('\n\n');
