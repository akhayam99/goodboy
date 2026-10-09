const IMAGE_URL =
  /^https?:\/\/\S+(?:\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?|\/user-attachments\/\S+|githubusercontent\.com\/\S+)$/i;

type Params = {
  readonly draft: string;
  readonly pasted: string;
  readonly start: number;
  readonly end: number;
};

export const embedImageUrl = ({ draft, pasted, start, end }: Params): string | null => {
  const url = pasted.trim();
  if (!IMAGE_URL.test(url)) {
    return null;
  }
  return `${draft.slice(0, start)}![](${url})${draft.slice(end)}`;
};
