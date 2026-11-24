import type { ComponentType } from 'react';
import { ActivityGroupsScene } from '../../ActivityGroupsScene';
import { ActivityLogScene } from '../../ActivityLogScene';
import { ActivityQuestionScene } from '../../ActivityQuestionScene';
import { ActivityTimelineScene } from '../../ActivityScenes';
import { ThemedScene } from '../../u37/ThemedScene';

export const ACTIVITY_FEED_SCENES = {
  'activity-light': () => (
    <ThemedScene theme="light">
      <ActivityTimelineScene />
    </ThemedScene>
  ),
  'activity-groups-light': () => (
    <ThemedScene theme="light">
      <ActivityGroupsScene />
    </ThemedScene>
  ),
  'activity-question-light': () => (
    <ThemedScene theme="light">
      <ActivityQuestionScene />
    </ThemedScene>
  ),
  'activity-log-light': () => (
    <ThemedScene theme="light">
      <ActivityLogScene />
    </ThemedScene>
  ),
} satisfies Readonly<Record<string, ComponentType>>;
