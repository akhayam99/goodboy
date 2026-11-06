const TALK_STARTS = [
  'title ',
  'titolo ',
  'il titolo',
  'the title',
  'titre ',
  'titel ',
  'titulo ',
  'título ',
  'role:',
  'ruolo:',
  'auto routed',
];

type Params = {
  readonly text: string;
};

export const talksAboutTitle = ({ text }: Params): boolean => {
  const lower = `${text.trim().toLowerCase()} `;
  return TALK_STARTS.some((start) => lower.startsWith(start));
};
