type Params = {
  readonly combo: string;
};

export const hasChordModifier = ({ combo }: Params): boolean => {
  const parts = combo.split('+');
  const code = parts.at(-1) ?? '';
  return (
    /^F[0-9]{1,2}$/.test(code) ||
    parts.slice(0, -1).some((part) => part === 'cmd' || part === 'ctrl' || part === 'alt')
  );
};
