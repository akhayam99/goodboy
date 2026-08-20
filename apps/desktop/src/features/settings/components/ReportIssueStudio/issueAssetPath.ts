const MAX_NAME_CHARS = 60;

const padded = ({ value }: { readonly value: number }): string => String(value).padStart(2, '0');

const assetFileName = ({ fileName }: { readonly fileName: string }): string => {
  const base = fileName.split('/').pop() ?? '';
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^[-.]+/, '');
  const capped = cleaned.slice(0, MAX_NAME_CHARS);
  return capped === '' ? 'image.png' : capped;
};

type Params = {
  readonly fileName: string;
  readonly index: number;
  readonly now: Date;
};

export const issueAssetPath = ({ fileName, index, now }: Params): string => {
  const month = padded({ value: now.getUTCMonth() + 1 });
  const ordinal = padded({ value: index + 1 });
  return `reports/${now.getUTCFullYear()}-${month}/${now.getTime()}-${ordinal}-${assetFileName({ fileName })}`;
};
