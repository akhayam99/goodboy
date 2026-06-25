import type { CredentialId, IsoDateTime } from './ids'
import type { ProviderId } from './provider-registry'

export const CLI_CREDENTIAL = 'cli'

export type ProviderCredential = {
  readonly id: CredentialId
  readonly providerId: ProviderId
  readonly label: string
  readonly hint: string
  readonly createdAt: IsoDateTime
}
