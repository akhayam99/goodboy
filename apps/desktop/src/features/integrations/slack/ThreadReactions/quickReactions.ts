export type QuickReaction = {
  readonly name: string;
  readonly emoji: string;
};

export const QUICK_REACTIONS: ReadonlyArray<QuickReaction> = [
  { name: 'eyes', emoji: '👀' },
  { name: '+1', emoji: '👍' },
  { name: 'white_check_mark', emoji: '✅' },
  { name: 'tada', emoji: '🎉' },
];

const BY_NAME: ReadonlyMap<string, string> = new Map(
  QUICK_REACTIONS.map((reaction) => [reaction.name, reaction.emoji]),
);

type EmojiParams = {
  readonly name: string;
};

export const reactionEmoji = ({ name }: EmojiParams): string => BY_NAME.get(name) ?? `:${name}:`;
