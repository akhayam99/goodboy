import type { WriterWaitView } from './useWriterWait';

type WriterWaitCopy = Readonly<{
  title: string;
  body: string;
}>;

type Params = Readonly<{ view: WriterWaitView }>;

const ONE_WRITER = 'One session writes in a folder at a time.';
const MEANWHILE = 'Until then, agents here can read and answer.';
const OTHER_AGENT = 'Another agent is writing in this folder.';

const whenLine = ({ minutes }: Pick<WriterWaitView, 'minutes'>): string => {
  if (minutes === null) {
    return 'This turn starts by itself when it finishes.';
  }
  const unit = minutes === 1 ? 'minute' : 'minutes';
  return `This turn starts by itself when it finishes, in about ${minutes} ${unit}.`;
};

const writerName = ({ writer }: Pick<WriterWaitView, 'writer'>): string => {
  if (writer.kind === 'session') {
    return writer.sessionTitle;
  }
  if (writer.kind === 'this-session') {
    return 'Another agent in this session';
  }
  return 'Another session';
};

export const writerWaitCopy = ({ view }: Params): WriterWaitCopy => {
  const when = whenLine({ minutes: view.minutes });
  if (view.folderName === null) {
    const lines = [OTHER_AGENT, when, MEANWHILE];
    return { title: 'Waiting for the writer.', body: lines.join(' ') };
  }
  const writing = `${writerName({ writer: view.writer })} is writing there now.`;
  const lines = [writing, ONE_WRITER, when, MEANWHILE];
  return { title: `Waiting to write in ${view.folderName}.`, body: lines.join(' ') };
};
