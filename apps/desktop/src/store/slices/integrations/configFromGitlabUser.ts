import type { GitlabIntegrationConfig } from '@goodboy/types'
import type { GitlabUser } from '../../../features/integrations/gitlab/client'

export const configFromGitlabUser = (user: GitlabUser): Omit<GitlabIntegrationConfig, 'host'> => {
  return {
    userName: user.name,
    userId: String(user.id),
  }
}
