import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import OrganizerArea from './OrganizerArea'
import type { OrganizerContext, WorkspaceData } from './api'

const marco = { id: 'marco', first_name: 'Marco', last_name: 'Example' }
const enrico = { id: 'enrico', first_name: 'Enrico', last_name: 'Example' }
const unassigned = { id: 'unassigned', first_name: 'Unassigned', last_name: 'Example' }
const eventMember = { id: 'event-member', first_name: 'Event', last_name: 'Member' }
const session = { user: { id: marco.id }, access_token: 'test-token' } as Session
const emptyWork = (organizerId: string) => ({ organizer_id: organizerId, working_on: '', next_steps: '', revision: 1, updated_at: null, updated_by: null })

function fixture(initialContext: OrganizerContext = { authorized: true, is_admin: false, profile: marco }, initialSession: Session | null = session) {
  let context = initialContext
  const workspace: WorkspaceData = {
    people: [marco, enrico, unassigned, eventMember],
    groups: [
      { id: 'spaces', name: 'Spaces', mission: 'Find locations for events', archived_at: null, revision: 1, members: [emptyWork(marco.id), { ...emptyWork(enrico.id), working_on: 'Calling venues' }], updates: [] },
      { id: 'events', name: 'Events', mission: 'Find speakers', archived_at: null, revision: 1, members: [emptyWork(eventMember.id)], updates: [] },
      { id: 'archive', name: 'Previous event', mission: 'Past work', archived_at: '2026-10-01', revision: 1, members: [emptyWork(marco.id)], updates: [] },
    ],
  }
  const rpc = vi.fn().mockImplementation(async (name: string, args?: Record<string, unknown>) => {
    if (name === 'organizer_context') return { data: context, error: null }
    if (name === 'organizer_workspace') return { data: structuredClone(workspace), error: null }
    if (name === 'organizer_group_choices') return { data: workspace.groups.filter(group => !group.archived_at), error: null }
    if (name === 'admin_workspace_access') return { data: { admins: [marco.id], accounts: [{ id: marco.id, email: 'marco@example.com' }], invitations: [] }, error: null }
    if (name === 'complete_organizer_onboarding') context = { ...context, profile: marco }
    if (name === 'save_member_work') {
      const member = workspace.groups.find(group => group.id === args?.p_group_id)?.members.find(member => member.organizer_id === args?.p_organizer_id)
      if (member) {
        member.working_on = String(args?.p_working_on)
        member.next_steps = String(args?.p_next_steps)
        member.revision++
      }
    }
    return { data: null, error: null }
  })
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: initialSession }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  }
  const invoke = vi.fn().mockResolvedValue({ data: { message: 'Invitation email sent.' }, error: null })
  return { client: { rpc, auth, functions: { invoke } } as unknown as SupabaseClient, rpc, auth, invoke, workspace }
}

afterEach(() => window.history.replaceState({}, '', '/'))

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  } })
})
afterAll(() => {
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})

async function editEnrico() {
  fireEvent.click(await screen.findByRole('button', { name: 'View Enrico Example’s work' }))
  const dialog = await screen.findByRole('dialog', { name: 'Spaces · Member work' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Edit Enrico Example’s work' }))
  return dialog
}

describe('organizer account access', () => {
  it('shows setup state without a configured client', () => {
    window.history.replaceState({}, '', '/organizers')
    render(<OrganizerArea client={null} />)
    expect(screen.getByRole('status')).toHaveTextContent('The workspace is being set up')
  })

  it('requires login before retrieving workspace data and supports password recovery', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client, rpc, auth } = fixture(undefined, null)
    render(<OrganizerArea client={client} />)
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Create your account' })).toHaveAttribute('href', '/organizers/register')
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'marco@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'marco@example.com', password: 'correct-password' }))
    fireEvent.click(screen.getByRole('button', { name: 'Forgot your password?' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'marco@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('status')).toHaveTextContent('If this email has an account')
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('marco@example.com', { redirectTo: `${window.location.origin}/organizers/recovery` })
  })

  it('denies authenticated non-organizers without loading group data', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client, rpc } = fixture({ authorized: false, profile: null, is_admin: false })
    render(<OrganizerArea client={client} />)
    expect(await screen.findByRole('heading', { name: 'Organizer access required.' })).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('organizer_context', undefined)
    expect(rpc).not.toHaveBeenCalledWith('organizer_workspace', undefined)
  })

  it('onboards with only names, password, and optional multiple groups', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client, rpc, auth } = fixture({ authorized: true, profile: null, is_admin: false })
    render(<OrganizerArea client={client} />)
    expect(await screen.findByRole('heading', { name: 'Create your account.' })).toBeInTheDocument()
    expect(await screen.findByRole('checkbox', { name: /Spaces/ })).not.toBeChecked()
    expect(screen.queryByLabelText(/department|affiliation|school/i)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Marco' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Example' } })
    fireEvent.change(screen.getByLabelText('Password (at least 12 characters)'), { target: { value: 'a-long-password' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'a-long-password' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Spaces/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Events/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create account and open workspace' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('complete_organizer_onboarding', { p_first_name: 'Marco', p_last_name: 'Example', p_group_ids: ['spaces', 'events'] }))
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'a-long-password' })
    expect(await screen.findByRole('heading', { name: 'Our working groups' })).toBeInTheDocument()
  })

  it.each(['/organizers/register', '/organizers/accept'])('verifies an invitation at %s only after a click and removes its token from the URL', async path => {
    window.history.replaceState({}, '', `${path}?token_hash=private-token&type=invite`)
    const { client, auth } = fixture({ authorized: true, profile: null, is_admin: false }, null)
    render(<OrganizerArea client={client} />)
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('textbox', { name: 'First name' })).toBeInTheDocument()
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'private-token', type: 'invite' })
    expect(window.location.search).toBe('')
  })

  it('explains invitation-only registration without offering public signup', async () => {
    window.history.replaceState({}, '', '/organizers/register')
    const { client, rpc, auth } = fixture(undefined, null)
    render(<OrganizerArea client={client} />)
    expect(await screen.findByRole('heading', { name: 'Create your account.' })).toBeInTheDocument()
    expect(screen.getByText(/A club admin chooses who can join/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/organizers')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(auth.signUp).not.toHaveBeenCalled()
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('lets an invitee register and enter the workspace without further approval', async () => {
    window.history.replaceState({}, '', '/organizers/register?token_hash=invite-token&type=invite')
    const { client, rpc, auth } = fixture({ authorized: true, profile: null, is_admin: false }, null)
    render(<OrganizerArea client={client} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('textbox', { name: 'First name' })
    await screen.findByRole('checkbox', { name: /Spaces/ })
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Marco' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Example' } })
    fireEvent.change(screen.getByLabelText('Password (at least 12 characters)'), { target: { value: 'a-long-password' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'a-long-password' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Spaces/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create account and open workspace' }))
    expect(await screen.findByRole('heading', { name: 'Our working groups' })).toBeInTheDocument()
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'invite-token', type: 'invite' })
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'a-long-password' })
    expect(rpc).toHaveBeenCalledWith('complete_organizer_onboarding', { p_first_name: 'Marco', p_last_name: 'Example', p_group_ids: ['spaces'] })
    expect(auth.signUp).not.toHaveBeenCalled()
    expect(window.location.pathname).toBe('/organizers')
    expect(window.location.search).toBe('')
  })

  it('does not grant registration access to an authenticated non-organizer', async () => {
    window.history.replaceState({}, '', '/organizers/register')
    const { client, rpc, auth } = fixture({ authorized: false, profile: null, is_admin: false })
    render(<OrganizerArea client={client} />)
    expect(await screen.findByRole('heading', { name: 'Organizer access required.' })).toBeInTheDocument()
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
    expect(auth.signUp).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalledWith('organizer_group_choices', undefined)
    expect(rpc).not.toHaveBeenCalledWith('complete_organizer_onboarding', expect.anything())
  })

  it('rejects non-invitation tokens on the registration route', async () => {
    window.history.replaceState({}, '', '/organizers/register?token_hash=other-token&type=recovery')
    const { client, rpc, auth } = fixture(undefined, null)
    render(<OrganizerArea client={client} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This link is invalid')
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('handles an expired invitation without exposing auth details', async () => {
    window.history.replaceState({}, '', '/organizers/accept?token_hash=expired&type=invite')
    const { client, auth } = fixture(undefined, null)
    auth.verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: { message: 'internal provider detail' } })
    render(<OrganizerArea client={client} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('expired or was already used')
    expect(screen.queryByText('internal provider detail')).not.toBeInTheDocument()
  })

  it('sets a recovered password before opening the workspace', async () => {
    window.history.replaceState({}, '', '/organizers/recovery?token_hash=recovery-token&type=recovery')
    const { client, auth } = fixture(undefined, null)
    render(<OrganizerArea client={client} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('heading', { name: 'Choose a new password.' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Password (at least 12 characters)'), { target: { value: 'new-long-password' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'new-long-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }))
    expect(await screen.findByRole('heading', { name: 'Our working groups' })).toBeInTheDocument()
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-long-password' })
  })
})

describe('working group overview', () => {
  it('shows compact member previews without supervisor or admin indicators', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client } = fixture()
    render(<OrganizerArea client={client} />)
    const spaces = await screen.findByRole('region', { name: 'Spaces' })
    expect(within(spaces).getByText('Calling venues')).toBeInTheDocument()
    expect(within(spaces).getByRole('button', { name: 'View Enrico Example’s work' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Events' })).queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Supervisors' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Administration' })).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Previous event' })).queryByRole('button', { name: /Join group|Leave group|Edit/ })).not.toBeInTheDocument()
  })

  it('lets a member edit another person’s summary in the same group', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client, rpc } = fixture()
    render(<OrganizerArea client={client} />)
    const dialog = await editEnrico()
    fireEvent.change(screen.getByRole('textbox', { name: 'Working on' }), { target: { value: 'Visiting two venues' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Next steps' }), { target: { value: 'Confirm dates' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save summary' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('save_member_work', { p_group_id: 'spaces', p_organizer_id: 'enrico', p_working_on: 'Visiting two venues', p_next_steps: 'Confirm dates', p_revision: 1 }))
    expect(await within(dialog).findByText('Visiting two venues')).toBeInTheDocument()
  })

  it('preserves a conflicting draft across refresh and requires explicit loading of latest work', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client, rpc, workspace } = fixture()
    const original = rpc.getMockImplementation()!
    rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) => name === 'save_member_work' ? { data: null, error: { code: '40001' } } : original(name, args))
    render(<OrganizerArea client={client} />)
    const dialog = await editEnrico()
    fireEvent.change(screen.getByRole('textbox', { name: 'Working on' }), { target: { value: 'My unsaved draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save summary' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your text has been kept')
    workspace.groups[0].members[1].revision = 2
    workspace.groups[0].members[1].working_on = 'Newer server summary'
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refresh details' }))
    expect(await screen.findByRole('button', { name: 'Load latest summary' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Working on' })).toHaveValue('My unsaved draft')
    fireEvent.click(screen.getByRole('button', { name: 'Load latest summary' }))
    expect(screen.getByRole('textbox', { name: 'Working on' })).toHaveValue('Newer server summary')
  })

  it('lets an organizer without groups read and choose a group without assigning a role', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client, rpc } = fixture({ authorized: true, is_admin: false, profile: unassigned })
    render(<OrganizerArea client={client} />)
    const spaces = await screen.findByRole('region', { name: 'Spaces' })
    expect(within(spaces).queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()
    fireEvent.click(within(spaces).getByRole('button', { name: 'Join group' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('set_organizer_membership', { p_group_id: 'spaces', p_join: true }))
  })

  it('preserves an open draft when Supabase repeats sign-in on window focus', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client, auth } = fixture()
    render(<OrganizerArea client={client} />)
    await editEnrico()
    fireEvent.change(screen.getByRole('textbox', { name: 'Working on' }), { target: { value: 'An unsaved draft' } })
    await act(async () => {
      auth.onAuthStateChange.mock.calls[0][0]('SIGNED_IN', { ...session, access_token: 'refreshed-token' })
      fireEvent(window, new Event('focus'))
    })
    expect(screen.getByRole('textbox', { name: 'Working on' })).toHaveValue('An unsaved draft')
  })

  it('removes workspace content when refreshed access is revoked', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client, rpc } = fixture()
    render(<OrganizerArea client={client} />)
    await screen.findByRole('region', { name: 'Spaces' })
    rpc.mockImplementation(async (name: string) => name === 'organizer_workspace'
      ? { data: null, error: { code: '42501' } }
      : { data: { authorized: false, profile: null, is_admin: false }, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByRole('heading', { name: 'Organizer access required.' })).toBeInTheDocument()
    expect(screen.queryByText('Calling venues')).not.toBeInTheDocument()
  })

  it('returns to login and removes the overview after signing out', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client, auth } = fixture()
    render(<OrganizerArea client={client} />)
    await screen.findByRole('region', { name: 'Spaces' })
    auth.signOut.mockImplementation(async () => {
      auth.onAuthStateChange.mock.calls[0][0]('SIGNED_OUT', null)
      return { error: null }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByText('Calling venues')).not.toBeInTheDocument()
    expect(auth.signOut).toHaveBeenCalledOnce()
  })

  it('gives admins private management alongside ordinary group editing', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client, invoke } = fixture({ authorized: true, is_admin: true, profile: marco })
    render(<OrganizerArea client={client} />)
    const dialog = await editEnrico()
    expect(within(dialog).getByRole('textbox', { name: 'Working on' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close ×' }))
    fireEvent.click(screen.getByRole('button', { name: 'Administration' }))
    expect(await screen.findByText('marco@example.com · Admin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revoke access' })).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Invite an organizer by email' }), { target: { value: 'ada@example.com' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send invitation' })))
    expect(invoke).toHaveBeenCalledWith('organizer-invite', { body: { email: 'ada@example.com' } })
    expect(screen.getByRole('status')).toHaveTextContent('Invitation email sent.')
  })

  it('keeps large rosters compact and opens complete member work separately', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client, workspace } = fixture()
    for (let index = 0; index < 30; index++) {
      const person = { id: `extra-${index}`, first_name: `Member ${index}`, last_name: 'Example' }
      workspace.people.push(person)
      workspace.groups[0].members.push({ ...emptyWork(person.id), working_on: `Work for member ${index}` })
    }
    workspace.groups[0].members[1].next_steps = 'Schedule a venue visit'
    render(<OrganizerArea client={client} />)
    const roster = await screen.findByRole('region', { name: 'Spaces member list' })
    expect(within(roster).getAllByRole('listitem')).toHaveLength(32)
    expect(screen.queryByText('Schedule a venue visit')).not.toBeInTheDocument()
    fireEvent.click(within(roster).getByRole('button', { name: 'View Enrico Example’s work' }))
    const dialog = await screen.findByRole('dialog', { name: 'Spaces · Member work' })
    expect(within(dialog).getByText('Schedule a venue visit')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close ×' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reads and publishes recent updates in a separate dialog', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client, rpc } = fixture()
    render(<OrganizerArea client={client} />)
    const group = await screen.findByRole('region', { name: 'Spaces' })
    fireEvent.click(within(group).getByRole('button', { name: 'Recent updates (0) ↗' }))
    const dialog = await screen.findByRole('dialog', { name: 'Spaces · Recent updates' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Share a recent update' }), { target: { value: 'Venue visit confirmed' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish update' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('publish_group_update', { p_group_id: 'spaces', p_subject_id: 'marco', p_body: 'Venue visit confirmed' }))
  })

  it('keeps another group’s full member details read-only', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client } = fixture()
    render(<OrganizerArea client={client} />)
    fireEvent.click(await screen.findByRole('button', { name: 'View Event Member’s work' }))
    const dialog = await screen.findByRole('dialog', { name: 'Events · Member work' })
    expect(within(dialog).queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()
  })

  it('shows refresh failures inside the open dialog and keeps the draft', async () => {
    window.history.replaceState({}, '', '/organizers')
    const { client, rpc } = fixture()
    render(<OrganizerArea client={client} />)
    const dialog = await editEnrico()
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Working on' }), { target: { value: 'My draft' } })
    const original = rpc.getMockImplementation()!
    rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) => name === 'organizer_workspace'
      ? { data: null, error: { code: 'NETWORK' } }
      : original(name, args))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refresh details' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not refresh')
    expect(within(dialog).getByRole('textbox', { name: 'Working on' })).toHaveValue('My draft')
  })
})
