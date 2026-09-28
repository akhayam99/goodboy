import { Grid } from '../components/Grid';
import { CHAT_PLAIN, STORAGE_LOCAL } from '../figures';

export const StorageAndChat = () => (
  <Grid
    label="Storage and chat"
    cells={[
      {
        figure: STORAGE_LOCAL,
        title: 'Storage and security',
        text: 'Tasks, decisions and settings stay on your computer. No account, no server.',
      },
      {
        figure: CHAT_PLAIN,
        title: 'A plain chat',
        text: 'When a task needs no structure, talk to one agent and steer it by hand.',
      },
    ]}
  />
);
