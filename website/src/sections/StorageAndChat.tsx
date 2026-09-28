import { Grid } from '../components/Grid';
import { CHAT_PLAIN, STORAGE_LOCAL } from '../figures';

export const StorageAndChat = () => (
  <Grid
    label="Storage and chat"
    cells={[
      {
        figure: STORAGE_LOCAL,
        title: 'Storage',
        text: 'See what Goodboy keeps on disk, from worktrees to archived history, and free the space that can go.',
      },
      {
        figure: CHAT_PLAIN,
        title: 'A plain chat',
        text: 'When a task needs no structure, talk to one agent and steer it by hand.',
      },
    ]}
  />
);
