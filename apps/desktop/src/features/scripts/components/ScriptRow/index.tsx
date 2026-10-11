import { isService } from '../../classifyScript';
import { ServiceRow } from './ServiceRow';
import { TaskRow } from './TaskRow';
import type { ScriptRowProps } from './scriptRowProps';

export const ScriptRow = (props: ScriptRowProps) =>
  isService({ script: props.script }) ? <ServiceRow {...props} /> : <TaskRow {...props} />;
