type Params = {
  readonly text: string;
};

export const escapeLinkText = ({ text }: Params) => text.replace(/[\\[\]]/g, (mark) => `\\${mark}`);
