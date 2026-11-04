import type { ComponentType } from 'react';
import { AutoChatScene } from '../u24/AutoChatScene';

export const U34_AUTO_MOUNT_SCENES: Readonly<Record<string, ComponentType>> = {
  'u34-p21-mount-ask': () => <AutoChatScene state="mount-ask" />,
  'u34-p21-mount-mounting': () => <AutoChatScene state="mount-ask" mountAct="pending" />,
  'u34-p21-mount-failed': () => <AutoChatScene state="mount-ask" mountAct="failing" />,
  'u34-p21-mount-done': () => <AutoChatScene state="mount-done" />,
};
