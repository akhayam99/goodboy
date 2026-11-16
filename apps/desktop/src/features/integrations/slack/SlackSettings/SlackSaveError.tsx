import { Button, Notice } from '@goodboy/ui';
import type { SlackConfigSave } from './useSlackConfigSave';

type Props = {
  readonly save: SlackConfigSave;
};

export const SlackSaveError = ({ save }: Props) =>
  save.error === null ? null : (
    <Notice
      tone="danger"
      placement="inline"
      role="alert"
      title="Couldn't save the Slack setting, it stays as it was"
      body={save.error}
      actions={
        <Button size="sm" variant="secondary" onClick={save.retry}>
          Retry
        </Button>
      }
    />
  );
