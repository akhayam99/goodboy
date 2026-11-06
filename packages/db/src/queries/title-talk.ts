const TALK_STARTS = [
  'title ',
  'titolo ',
  'il titolo',
  'the title',
  'titre ',
  'titel ',
  'titulo ',
  'role:',
  'ruolo:',
  'auto routed',
];

const TALK_PARTS = [
  'title only',
  'routed to',
  'title generation',
  'generazione del titolo',
  'in italiano, quindi',
  'task richiede',
  'task requires',
];

type Params = {
  readonly text: string;
};

export const talksAboutTitle = ({ text }: Params): boolean => {
  const lower = `${text.trim().toLowerCase()} `;
  return (
    TALK_STARTS.some((start) => lower.startsWith(start)) ||
    TALK_PARTS.some((part) => lower.includes(part))
  );
};
