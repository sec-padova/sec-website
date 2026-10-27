import type { SupabaseClient } from '@supabase/supabase-js'

export interface Organizer {
  id: string
  first_name: string
  last_name: string
}

export interface OrganizerContext {
  authorized: boolean
  profile: Organizer | null
  is_admin: boolean
}

export interface MemberWork {
  organizer_id: string
  working_on: string
  next_steps: string
  revision: number
  updated_at: string | null
  updated_by: string | null
}

export interface GroupUpdate {
  id: string
  subject_name: string
  author_name: string
  body: string
  created_at: string
}

export interface WorkingGroup {
  id: string
  name: string
  mission: string
  archived_at: string | null
  revision: number
  members: MemberWork[]
  updates: GroupUpdate[]
}

export interface WorkspaceData {
  people: Organizer[]
  groups: WorkingGroup[]
}

export interface AdminAccess {
  admins: string[]
  accounts: { id: string, email: string }[]
  invitations: { email: string, invited_at: string, active: boolean, user_id: string | null }[]
}

export class WorkspaceError extends Error {
  code: string
  constructor(code: string) {
    super(code === '40001'
      ? 'This information changed while you were editing. Refresh, then load the latest version before saving. Your text has been kept.'
      : code === '42501'
        ? 'Your access changed. Refresh or sign in again.'
        : 'Could not complete this request. Please try again.')
    this.code = code
  }
}

export async function workspaceRpc<T>(client: SupabaseClient, name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new WorkspaceError(error.code)
  return data as T
}

export const fullName = (person: Organizer) => `${person.first_name} ${person.last_name}`
export const workspaceDate = (date: string) => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome',
}).format(new Date(date))
