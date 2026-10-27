import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fullName, workspaceDate, workspaceRpc, type AdminAccess, type WorkingGroup, type WorkspaceData } from './api'

type Mutate = (name: string, args: Record<string, unknown>) => Promise<void>

function GroupSettings({ group, mutate }: { group?: WorkingGroup, mutate: Mutate }) {
  const [name, setName] = useState(group?.name ?? '')
  const [mission, setMission] = useState(group?.mission ?? '')
  const [revision, setRevision] = useState(group?.revision)
  const [archived, setArchived] = useState(Boolean(group?.archived_at))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await mutate('admin_save_group', { p_name: name.trim(), p_mission: mission.trim(), p_group_id: group?.id ?? null, p_revision: revision ?? null, p_archived: archived })
      if (!group) {
        setName('')
        setMission('')
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save group.') }
    finally { setBusy(false) }
  }
  useEffect(() => {
    // Advance the revision only when the refreshed record exactly matches this form.
    if (group && group.name === name.trim() && group.mission === mission.trim() && Boolean(group.archived_at) === archived) setRevision(group.revision)
  }, [group, name, mission, archived])
  const prefix = group?.id ?? 'new'
  return <details className="admin-group-settings"><summary>{group ? `Manage ${group.name}` : 'Create a working group'}</summary><form className="workspace-form" onSubmit={save}>
    <label htmlFor={`name-${prefix}`}>Group name</label><input id={`name-${prefix}`} value={name} onChange={event => setName(event.target.value)} required maxLength={100} />
    <label htmlFor={`mission-${prefix}`}>Mission</label><textarea id={`mission-${prefix}`} value={mission} onChange={event => setMission(event.target.value)} required maxLength={2000} rows={3} />
    {group && <label className="workspace-checkbox"><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)} />Archive this group (read only)</label>}
    {group && revision !== group.revision && <p className="workspace-notice">A newer version is available. <button type="button" onClick={() => {
      setName(group.name)
      setMission(group.mission)
      setArchived(Boolean(group.archived_at))
      setRevision(group.revision)
      setError('')
    }}>Load latest group settings</button></p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="workspace-button" disabled={busy || !name.trim() || !mission.trim()}>{busy ? 'Saving…' : group ? 'Save group settings' : 'Create group'}</button>
  </form></details>
}

export default function AdminPanel({ client, data, currentUserId, mutate, onMessage }: { client: SupabaseClient, data: WorkspaceData, currentUserId: string, mutate: Mutate, onMessage: (message: string) => void }) {
  const [access, setAccess] = useState<AdminAccess | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    try {
      setAccess(await workspaceRpc(client, 'admin_workspace_access'))
      setError('')
    }
    catch {
      setAccess(null)
      setError('Could not load administration. Refresh to verify your access.')
    }
  }, [client])
  useEffect(() => { void reload() }, [reload, data])
  async function invite(event: FormEvent) {
    event.preventDefault()
    await sendInvitation(email.trim().toLowerCase())
  }
  async function sendInvitation(address: string) {
    setBusy(true)
    setError('')
    try {
      const { data: result, error: requestError } = await client.functions.invoke('organizer-invite', { body: { email: address } })
      if (requestError) throw new Error('Could not send the email. The invitation may be saved; refresh and retry sending it.')
      onMessage(result.message)
      setEmail('')
      await reload()
    } catch (error) {
      await reload()
      setError(error instanceof Error ? error.message : 'Could not send invitation.')
    }
    finally { setBusy(false) }
  }
  async function revoke(id: string | null, address: string) {
    if (!window.confirm(`Revoke workspace access for ${address}? Current group summaries will be removed; published updates remain.`)) return
    setBusy(true)
    setError('')
    try {
      await mutate('admin_revoke_organizer', { p_organizer_id: id, p_email: address })
      await reload()
      onMessage('Workspace access revoked.')
    }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not revoke access.') }
    finally { setBusy(false) }
  }
  async function membership(groupId: string, organizerId: string, join: boolean) {
    if (!join && !window.confirm('Remove this member from the group? Their current summary will be removed; published updates remain.')) return
    setBusy(true)
    setError('')
    try { await mutate('set_organizer_membership', { p_group_id: groupId, p_organizer_id: organizerId, p_join: join }) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not change membership.') }
    finally { setBusy(false) }
  }
  return <section className="workspace-admin" aria-labelledby="admin-title"><p className="eyebrow">Restricted to admins</p><h2 id="admin-title">Administration</h2>
    <p>Admin permission is private and independent of working-group membership. Admin appointments are made by the project owner.</p>
    <form className="workspace-form admin-invite-form" onSubmit={invite}><label htmlFor="invite-email">Invite an organizer by email</label><div className="workspace-actions"><input id="invite-email" type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={320} required /><button className="workspace-button" disabled={busy}>{busy ? 'Please wait…' : 'Send invitation'}</button></div></form>
    {error && <p role="alert" className="form-error">{error}</p>}
    {!access && <button className="workspace-text-button" onClick={() => void reload()}>Reload administration</button>}
    {access && <>
      <h3>Organizer accounts</h3><ul className="admin-account-list">{access.accounts.map(account => <li key={account.id}><span>{data.people.find(person => person.id === account.id) ? fullName(data.people.find(person => person.id === account.id)!) : 'Onboarding pending'}<small>{account.email}{access.admins.includes(account.id) ? ' · Admin' : ''}</small></span><button className="workspace-text-button" disabled={busy || (account.id === currentUserId && access.admins.length === 1)} onClick={() => void revoke(account.id, account.email)}>Revoke access</button></li>)}</ul>
      <details><summary>Invitation records ({access.invitations.length})</summary><ul className="admin-account-list">{access.invitations.map(invitation => <li key={invitation.email}><span>{invitation.email}<small>{invitation.active ? 'Access authorized' : 'Revoked'} · {workspaceDate(invitation.invited_at)}</small></span>{invitation.active && <div className="workspace-actions"><button className="workspace-text-button" disabled={busy} onClick={() => void sendInvitation(invitation.email)}>Send email again</button>{!invitation.user_id && <button className="workspace-text-button" disabled={busy} onClick={() => void revoke(null, invitation.email)}>Revoke invitation</button>}</div>}</li>)}</ul></details>
      <details><summary>Manage group memberships</summary>{data.groups.filter(group => !group.archived_at).map(group => <fieldset className="workspace-group-choices" key={group.id}><legend>{group.name}</legend>{data.people.map(person => <label key={person.id}><input type="checkbox" disabled={busy} checked={group.members.some(member => member.organizer_id === person.id)} onChange={event => void membership(group.id, person.id, event.target.checked)} />{fullName(person)}</label>)}</fieldset>)}</details>
    </>}
    <h3>Working groups</h3><GroupSettings mutate={mutate} />{data.groups.map(group => <GroupSettings key={group.id} group={group} mutate={mutate} />)}
  </section>
}
