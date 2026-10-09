export const TEXT_ROLE = {
  label: 'text-foreground',
  secondary: 'text-muted-foreground',
  hint: 'text-faint-foreground',
  disabled: 'text-disabled-foreground',
} as const;

export type TextRole = keyof typeof TEXT_ROLE;
