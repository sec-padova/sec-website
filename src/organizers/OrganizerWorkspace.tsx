import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { events } from '../events'
import EventCountdown from './EventCountdown'
import AdminPanel from './AdminPanel'
import WorkspaceDialog from './WorkspaceDialog'
import { fullName, workspaceDate, workspaceRpc, WorkspaceError, type MemberWork, type Organizer, type OrganizerContext, type WorkingGroup, type WorkspaceData } from './api'

type RunMutation = (name: string, args: Record<string, unknown>) => Promise<void>

function WorkSummary({ groupId, member, person, canEdit, run }: { groupId: string, member: MemberWork, person: Organizer, canEdit: boolean, run: RunMutation }) {
  const [editing, setEditing] = useState(false)
  const [workingOn, setWorkingOn] = useState(member.working_on)
  const [nextSteps, setNextSteps] = useState(member.next_steps)
  const [revision, setRevision] = useState(member.revision)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function loadLatest() {
    setWorkingOn(member.working_on)
    setNextSteps(member.next_steps)
    setRevision(member.revision)
    setError('')
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await run('save_member_work', { p_organizer_id: person.id, p_working_on: workingOn, p_next_steps: nextSteps, p_revision: revision })
      setEditing(false)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save. Please try again.') }
    finally { setBusy(false) }
  }
  const name = fullName(person)
  const fieldId = `${groupId}-${person.id}`
  return <article className="member-work" aria-label={`${name}’s work`}>
    <div className="member-work-heading"><span className="workspace-avatar" aria-hidden="true">{person.first_name.charAt(0)}</span><h4>{name}</h4>
      {canEdit && !editing && <button className="workspace-text-button" onClick={() => {
        loadLatest()
        setEditing(true)
      }} aria-label={`Edit ${name}’s work`}>Edit ↗</button>}
    </div>
    {editing && canEdit ? <form className="workspace-form" onSubmit={save}>
      <label htmlFor={`work-${fieldId}`}>Working on</label><textarea id={`work-${fieldId}`} value={workingOn} onChange={event => setWorkingOn(event.target.value)} maxLength={4000} rows={3} />
      <label htmlFor={`next-${fieldId}`}>Next steps</label><textarea id={`next-${fieldId}`} value={nextSteps} onChange={event => setNextSteps(event.target.value)} maxLength={4000} rows={3} />
      {revision !== member.revision && <p className="workspace-notice">A newer summary is available. Your draft has been kept. <button type="button" onClick={loadLatest}>Load latest summary</button></p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="workspace-actions"><button className="workspace-button" disabled={busy}>{busy ? 'Saving…' : 'Save summary'}</button><button type="button" className="workspace-text-button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button></div>
    </form> : <>
      <dl className="work-description"><dt>Working on</dt><dd>{member.working_on || 'No work shared yet.'}</dd><dt>Next steps</dt><dd>{member.next_steps || 'Not shared yet.'}</dd></dl>
      <p className="workspace-muted">{member.updated_at ? `Updated ${workspaceDate(member.updated_at)} · Padova time` : 'Ready for a first update.'}</p>
    </>}
  </article>
}

function GroupCard({ group, people, userId, mutate, refresh, refreshError }: { group: WorkingGroup, people: Organizer[], userId: string, mutate: RunMutation, refresh: () => Promise<void>, refreshError: string }) {
  const joined = group.members.some(member => member.organizer_id === userId)
  const canEdit = joined && !group.archived_at
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [subject, setSubject] = useState(userId)
  const [update, setUpdate] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [memberOpen, setMemberOpen] = useState(false)
  const [updatesOpen, setUpdatesOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const run: RunMutation = (name, args) => mutate(name, { p_group_id: group.id, ...args })
  const getPerson = (id: string) => people.find(person => person.id === id)
  async function membership(join: boolean) {
    if (busy) return
    setBusy(true)
    setError('')
    setLeaveError('')
    try {
      await run('set_organizer_membership', { p_join: join })
      if (!join) setLeaveOpen(false)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Could not change membership.'
      if (join) setError(message)
      else setLeaveError(message)
    }
    finally { setBusy(false) }
  }
  async function publish(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await run('publish_group_update', { p_subject_id: subject, p_body: update.trim() })
      setUpdate('')
    }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not publish update.') }
    finally { setBusy(false) }
  }
  const latest = group.updates[0]
  const selectedMember = group.members.find(member => member.organizer_id === selectedMemberId)
  const selectedPerson = selectedMemberId ? getPerson(selectedMemberId) : undefined
  return <section className={`workspace-group${group.archived_at ? ' workspace-group-archived' : ''}`} aria-labelledby={`group-${group.id}`}>
    <header className="workspace-group-header"><div><p className="eyebrow">{group.archived_at ? 'Archived group' : joined ? 'Your working group' : 'Working group'}</p><h3 id={`group-${group.id}`} title={group.name}>{group.name}</h3></div></header>
    <p className="group-mission" title={group.mission}>{group.mission}</p>
    <p className={`workspace-muted group-access${error ? ' form-error' : ''}`} role={error && !updatesOpen ? 'alert' : undefined} tabIndex={error ? 0 : undefined}>{error || (group.archived_at ? 'Archived · Read only' : canEdit ? 'Member · You can edit this group’s work.' : 'Read only · Join this group to edit its work.')}</p>
    <div className="group-roster-heading"><h4>Members <span>({group.members.length})</span></h4><span>Select a person to see their work</span></div>
    <div className="workspace-member-list" role="region" aria-label={`${group.name} member list`} tabIndex={0}>
      {group.members.length ? <ul className="group-roster">{group.members.map(member => {
        const person = getPerson(member.organizer_id)
        return person && <li key={person.id}><button className="group-member-button" aria-label={`View ${fullName(person)}’s work`} aria-describedby={`preview-${group.id}-${person.id}`} onClick={() => {
          setSelectedMemberId(person.id)
          setMemberOpen(true)
        }}>
          <span className="workspace-avatar" aria-hidden="true">{person.first_name.charAt(0)}</span>
          <span className="group-member-preview"><strong>{fullName(person)}</strong><span id={`preview-${group.id}-${person.id}`}>{member.working_on || 'No work shared yet.'}</span></span>
          <span aria-hidden="true">↗</span>
        </button></li>
      })}</ul> : <p className="workspace-empty">No members yet. Join this group to start sharing your work.</p>}
    </div>
    <div className="latest-update"><p className="eyebrow">Latest activity</p><p>{latest?.body ?? 'No updates published yet.'}</p>{latest && <small>{latest.subject_name} · {workspaceDate(latest.created_at)}</small>}</div>
    <footer className="group-card-footer"><button className="workspace-text-button" onClick={() => setUpdatesOpen(true)}>Recent updates ({group.updates.length}) ↗</button>
      {!group.archived_at && <button className="workspace-button workspace-button-small" onClick={() => {
        if (joined) {
          setLeaveError('')
          setLeaveOpen(true)
        } else void membership(true)
      }} disabled={busy}>{joined ? 'Leave group' : 'Join group'}</button>}
    </footer>
    <WorkspaceDialog open={leaveOpen} title={`Leave ${group.name}?`} id={`leave-dialog-${group.id}`} descriptionId={`leave-description-${group.id}`} dismissDisabled={busy} onClose={() => {
      if (!busy) setLeaveOpen(false)
    }}>
      <p id={`leave-description-${group.id}`}>Your current work summary and next steps will be removed from this group. Published updates remain in its history. You can join again later.</p>
      {leaveError && <p role="alert" className="form-error">{leaveError}</p>}
      <div className="workspace-actions"><button type="button" className="workspace-button" autoFocus disabled={busy} onClick={() => setLeaveOpen(false)}>Stay in group</button><button type="button" className="workspace-text-button" disabled={busy} onClick={() => void membership(false)}>{busy ? 'Leaving…' : 'Confirm leave'}</button></div>
    </WorkspaceDialog>
    {selectedMember && selectedPerson && <WorkspaceDialog open={memberOpen} title={`${group.name} · Member work`} id={`member-dialog-${group.id}`} onClose={() => setMemberOpen(false)} refresh={refresh} notice={refreshError}>
      {!canEdit && <p className="workspace-muted">{group.archived_at ? 'Archived · Read only' : 'Read only · Join this group to edit its work.'}</p>}
      <WorkSummary key={selectedPerson.id} groupId={group.id} person={selectedPerson} member={selectedMember} canEdit={canEdit} run={run} />
    </WorkspaceDialog>}
    <WorkspaceDialog open={updatesOpen} title={`${group.name} · Recent updates`} id={`updates-dialog-${group.id}`} onClose={() => setUpdatesOpen(false)} refresh={refresh} notice={refreshError}>
      {canEdit && <form onSubmit={publish} className="workspace-form">
        <label htmlFor={`subject-${group.id}`}>Whose work is this about?</label><select id={`subject-${group.id}`} value={subject} onChange={event => setSubject(event.target.value)} required>
          <option value="">Choose a member</option>
          {group.members.map(member => {
            const person = getPerson(member.organizer_id)
            return person && <option key={person.id} value={person.id}>{fullName(person)}</option>
          })}
        </select>
        <label htmlFor={`update-${group.id}`}>Share a recent update</label><textarea id={`update-${group.id}`} value={update} onChange={event => setUpdate(event.target.value)} required maxLength={4000} rows={3} />
        <button className="workspace-button" disabled={busy || !update.trim() || !group.members.some(member => member.organizer_id === subject)}>{busy ? 'Publishing…' : 'Publish update'}</button>
      </form>}
      {group.updates.length ? <ol className="workspace-update-list">{group.updates.map(item => <li key={item.id}><p>{item.body}</p><small>About {item.subject_name} · Posted by {item.author_name}<br /><time dateTime={item.created_at}>{workspaceDate(item.created_at)} · Padova time</time></small></li>)}</ol> : <p className="workspace-muted">No updates published yet.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </WorkspaceDialog>
  </section>
}

export default function OrganizerWorkspace({ client, context, onAccessChanged }: { client: SupabaseClient, context: OrganizerContext & { profile: Organizer }, onAccessChanged: () => void }) {
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const sequence = useRef(0)
  const accessChanged = useRef(onAccessChanged)
  accessChanged.current = onAccessChanged
  const refresh = useCallback(async () => {
    const current = ++sequence.current
    setLoading(true)
    try {
      const next = await workspaceRpc<WorkspaceData>(client, 'organizer_workspace')
      if (current === sequence.current) {
        setData(next)
        setError('')
      }
    } catch (error) {
      if (current !== sequence.current) return
      if (error instanceof WorkspaceError && error.code === '42501') {
        setData(null)
        accessChanged.current()
      }
      else setError('Could not refresh the workspace. Your unsaved edits have been kept. Please retry.')
    } finally { if (current === sequence.current) setLoading(false) }
  }, [client])
  useEffect(() => {
    void refresh()
    const focus = () => void refresh()
    window.addEventListener('focus', focus)
    return () => {
      sequence.current++
      window.removeEventListener('focus', focus)
    }
  }, [refresh])
  const mutate: RunMutation = async (name, args) => {
    try { await workspaceRpc(client, name, args) }
    catch (error) {
      if (error instanceof WorkspaceError && error.code === '42501') void refresh()
      throw error
    }
    await refresh()
  }
  async function signOut() {
    try {
      const { error } = await client.auth.signOut()
      if (error) setError('Could not sign out. Please retry.')
    } catch { setError('Could not sign out. Please retry.') }
  }
  const active = data?.groups.filter(group => !group.archived_at) ?? []
  const archived = data?.groups.filter(group => group.archived_at) ?? []
  return <>
    <div className="workspace-title-row"><div><p className="eyebrow">Welcome, {context.profile.first_name}</p><h1>Moving things<br /><em>forward, together.</em></h1></div>
      <div className="workspace-actions"><button className="workspace-button" disabled={loading} onClick={() => void refresh()}>{loading ? 'Refreshing…' : 'Refresh'}</button>{context.is_admin && <button className="workspace-button" aria-expanded={adminOpen} onClick={() => setAdminOpen(!adminOpen)}>Administration</button>}<button className="workspace-text-button" onClick={() => void signOut()}>Sign out</button></div>
    </div>
    <EventCountdown events={events} />
    {error && <p className="workspace-notice" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!data && !error && <p role="status">Loading working groups…</p>}
    {data && <>
      {context.is_admin && adminOpen && <AdminPanel client={client} data={data} currentUserId={context.profile.id} mutate={mutate} onMessage={setMessage} />}
      <div className="workspace-section-heading"><h2>Our working groups</h2><p>Who’s here, what’s happening, and what comes next.</p></div>
      <div className="workspace-groups">{active.map(group => <GroupCard key={group.id} group={group} people={data.people} userId={context.profile.id} mutate={mutate} refresh={refresh} refreshError={error} />)}</div>
      {!active.length && <p className="workspace-empty">No open groups yet. An admin can create one.</p>}
      {archived.length > 0 && <details className="workspace-archives"><summary>Archived groups ({archived.length})</summary><div className="workspace-groups">{archived.map(group => <GroupCard key={group.id} group={group} people={data.people} userId={context.profile.id} mutate={mutate} refresh={refresh} refreshError={error} />)}</div></details>}
    </>}
  </>
}
