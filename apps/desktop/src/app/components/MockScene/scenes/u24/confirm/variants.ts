export const VARIANTS = [
  'notifications',
  'sessiondelete',
  'chatrow',
  'rich',
  'activity',
  'note',
] as const;

export type Variant = (typeof VARIANTS)[number];

export const isVariant = (value: string | null): value is Variant =>
  VARIANTS.some((variant) => variant === value);

export const settle = async (): Promise<void> => {
  await Promise.resolve();
};
