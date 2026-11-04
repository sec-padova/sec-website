import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { registrationRequest } from './SharedRegistration'
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
  const [sharedLink, setSharedLink] = useState('')
  const [linkStatus, setLinkStatus] = useState<{ expires_at: string | null, revoked_at: string | null } | null>(null)
  const [invitation, setInvitation] = useState<{ email: string, url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    try {
      const link = await registrationRequest(client, { action: 'link-status' })
      setLinkStatus(link.link)
      setAccess(await workspaceRpc(client, 'admin_workspace_access'))
      setError('')
    }
    catch {
      setAccess(null)
      setError('Could not load administration. Refresh to verify your access.')
    }
  }, [client])
  useEffect(() => { void reload() }, [reload, data])
  async function manageLink(action: 'create-link' | 'revoke-link') {
    setBusy(true)
    setError('')
    try {
      const result = await registrationRequest(client, { action })
      setSharedLink(result.invitation_url ?? '')
      setLinkStatus(result.link)
      onMessage(action === 'create-link' ? 'Shared registration link ready.' : 'Registration link revoked.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not update link.') }
    finally { setBusy(false) }
  }
  async function restore(address: string) {
    setBusy(true)
    setError('')
    try { await mutate('admin_restore_organizer', { p_email: address }); await reload(); onMessage('Workspace access restored.') }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not restore access.') }
    finally { setBusy(false) }
  }
  async function sendRecoveryLink(address: string) {
    setBusy(true)
    setError('')
    setInvitation(null)
    try {
      const { data: result, error: requestError } = await client.functions.invoke('organizer-invite', { body: { email: address } })
      if (requestError || !result?.invitation_url) throw new Error('Could not create the password recovery link. Please retry.')
      setInvitation({ email: result.email, url: result.invitation_url })
      onMessage(result.message)
      await reload()
    } catch (error) {
      await reload()
      setError(error instanceof Error ? error.message : 'Could not create password recovery link.')
    }
    finally { setBusy(false) }
  }
  async function revoke(id: string | null, address: string) {
    if (!window.confirm(`Revoke workspace access for ${address}? Current group summaries will be removed; published updates remain.`)) return
    setBusy(true)
    setError('')
    try {
      await mutate('admin_revoke_organizer', { p_organizer_id: id, p_email: address })
      if (invitation?.email === address) setInvitation(null)
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
    <h3>Shared registration link</h3>
    <p>Anyone with this link can register for eight hours. Creating a replacement invalidates the previous link immediately.</p>
    {linkStatus?.expires_at && <p>{linkStatus.revoked_at ? 'Revoked' : new Date(linkStatus.expires_at).getTime() <= Date.now() ? 'Expired' : 'Valid'} · Expires {workspaceDate(linkStatus.expires_at)} · Padova time</p>}
    <div className="workspace-actions"><button className="workspace-button" disabled={busy} onClick={() => void manageLink('create-link')}>{linkStatus?.expires_at ? 'Replace registration link' : 'Create registration link'}</button>{linkStatus?.expires_at && !linkStatus.revoked_at && <button className="workspace-text-button" disabled={busy} onClick={() => void manageLink('revoke-link')}>Revoke registration link</button>}</div>
    {sharedLink && <div className="workspace-form"><label htmlFor="shared-link">Shared registration link</label><input id="shared-link" readOnly value={sharedLink} onFocus={event => event.target.select()} /><button className="workspace-button" onClick={async () => { try { await navigator.clipboard.writeText(sharedLink); onMessage('Registration link copied.') } catch { setError('Select and copy the registration link above.') } }}>Copy registration link</button></div>}
    <p className="workspace-muted">Copy the link now. After reloading, create a replacement to copy another.</p>
    {invitation && <div className="workspace-notice workspace-form">
      <label htmlFor="private-invitation-link">Private link for {invitation.email}</label>
      <input id="private-invitation-link" readOnly value={invitation.url} onFocus={event => event.target.select()} />
      <p>This link grants access to this person’s account. Send it only to them. It expires after one hour; create a new link if needed.</p>
      <div className="workspace-actions"><button className="workspace-button" type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(invitation.url); onMessage('Private link copied.') }
        catch { setError('Could not copy automatically. Select and copy the private link above.') }
      }}>Copy private link</button><button className="workspace-text-button" type="button" onClick={() => setInvitation(null)}>Hide link</button></div>
    </div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {!access && <button className="workspace-text-button" onClick={() => void reload()}>Reload administration</button>}
    {access && <>
      <h3>Organizer accounts</h3><ul className="admin-account-list">{access.accounts.map(account => <li key={account.id}><span>{data.people.find(person => person.id === account.id) ? fullName(data.people.find(person => person.id === account.id)!) : 'Onboarding pending'}<small>{account.email}{access.admins.includes(account.id) ? ' · Admin' : ''}</small></span><button className="workspace-text-button" disabled={busy} onClick={() => void sendRecoveryLink(account.email)}>Create password recovery link</button><button className="workspace-text-button" disabled={busy || (account.id === currentUserId && access.admins.length === 1)} onClick={() => void revoke(account.id, account.email)}>Revoke access</button></li>)}</ul>
      <details><summary>Access records ({access.invitations.length})</summary><ul className="admin-account-list">{access.invitations.map(invitation => <li key={invitation.email}><span>{invitation.email}<small>{invitation.active ? 'Access authorized' : 'Revoked'} · {workspaceDate(invitation.invited_at)}</small></span>{invitation.active && <div className="workspace-actions"><button className="workspace-text-button" disabled={busy} onClick={() => void sendRecoveryLink(invitation.email)}>Create password recovery link</button><button className="workspace-text-button" disabled={busy} onClick={() => void revoke(invitation.user_id, invitation.email)}>Revoke access</button></div>}{!invitation.active && invitation.user_id && <button className="workspace-text-button" disabled={busy} onClick={() => void restore(invitation.email)}>Restore access</button>}</li>)}</ul></details>
      <details><summary>Manage group memberships</summary>{data.groups.filter(group => !group.archived_at).map(group => <fieldset className="workspace-group-choices" key={group.id}><legend>{group.name}</legend>{data.people.map(person => <label key={person.id}><input type="checkbox" disabled={busy} checked={group.members.some(member => member.organizer_id === person.id)} onChange={event => void membership(group.id, person.id, event.target.checked)} />{fullName(person)}</label>)}</fieldset>)}</details>
    </>}
    <h3>Working groups</h3><GroupSettings mutate={mutate} />{data.groups.map(group => <GroupSettings key={group.id} group={group} mutate={mutate} />)}
  </section>
}
