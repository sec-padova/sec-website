import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import OrganizerWorkspace from './OrganizerWorkspace'
import type { WorkspaceData } from './api'

const person = { id: 'marco', first_name: 'Marco', last_name: 'Example' }
const context = { authorized: true, is_admin: false, profile: person }
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

function fixture() {
  const workspace: WorkspaceData = { people: [person], groups: [{
    id: 'spaces', name: 'Spaces', mission: 'Find event venues', archived_at: null, revision: 1,
    members: [{ organizer_id: person.id, working_on: 'Calling venues', next_steps: 'Arrange visits', revision: 1, updated_at: null, updated_by: null }], updates: [],
  }] }
  const rpc = vi.fn().mockImplementation(async (name: string, args?: Record<string, unknown>) => {
    if (name === 'organizer_workspace') return { data: structuredClone(workspace), error: null }
    if (name === 'set_organizer_membership' && !args?.p_join) workspace.groups[0].members = []
    return { data: null, error: null }
  })
  const client = { rpc, auth: { signOut: vi.fn() } } as unknown as SupabaseClient
  return { client, rpc }
}

async function openLeaveDialog() {
  fireEvent.click(await screen.findByRole('button', { name: 'Leave group' }))
  return screen.getByRole('dialog', { name: 'Leave Spaces?' })
}

describe('leaving a working group', () => {
  it('asks for confirmation and leaves memberships unchanged when cancelled', async () => {
    const { client, rpc } = fixture()
    render(<OrganizerWorkspace client={client} context={context} onAccessChanged={vi.fn()} />)
    const dialog = await openLeaveDialog()
    expect(dialog).toHaveAccessibleDescription(/current work summary and next steps will be removed/)
    expect(rpc).not.toHaveBeenCalledWith('set_organizer_membership', expect.anything())
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stay in group' }))
    expect(screen.queryByRole('dialog', { name: 'Leave Spaces?' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave group' })).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalledWith('set_organizer_membership', expect.anything())
  })

  it('supports dismissal with Escape or the close button without leaving', async () => {
    const { client, rpc } = fixture()
    render(<OrganizerWorkspace client={client} context={context} onAccessChanged={vi.fn()} />)
    const dialog = await openLeaveDialog()
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog', { name: 'Leave Spaces?' })).not.toBeInTheDocument()
    const reopened = await openLeaveDialog()
    fireEvent.click(within(reopened).getByRole('button', { name: 'Close ×' }))
    expect(screen.queryByRole('dialog', { name: 'Leave Spaces?' })).not.toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalledWith('set_organizer_membership', expect.anything())
  })

  it('changes membership only after confirmation and refreshes the card', async () => {
    const { client, rpc } = fixture()
    render(<OrganizerWorkspace client={client} context={context} onAccessChanged={vi.fn()} />)
    const dialog = await openLeaveDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm leave' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('set_organizer_membership', { p_group_id: 'spaces', p_join: false }))
    expect(await screen.findByRole('button', { name: 'Join group' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Leave Spaces?' })).not.toBeInTheDocument())
  })

  it('keeps the confirmation open on failure and allows retry', async () => {
    const { client, rpc } = fixture()
    const original = rpc.getMockImplementation()!
    let fail = true
    rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) => {
      if (name === 'set_organizer_membership' && fail) return { data: null, error: { code: 'XX000' } }
      return original(name, args)
    })
    render(<OrganizerWorkspace client={client} context={context} onAccessChanged={vi.fn()} />)
    const dialog = await openLeaveDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm leave' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Please try again')
    expect(within(dialog).getByRole('button', { name: 'Confirm leave' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Leave group' })).toBeInTheDocument()
    fail = false
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm leave' }))
    expect(await screen.findByRole('button', { name: 'Join group' })).toBeInTheDocument()
  })

  it('prevents duplicate requests and dismissal while leaving', async () => {
    const { client, rpc } = fixture()
    const original = rpc.getMockImplementation()!
    let finish!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) => {
      if (name === 'set_organizer_membership') await pending
      return original(name, args)
    })
    render(<OrganizerWorkspace client={client} context={context} onAccessChanged={vi.fn()} />)
    const dialog = await openLeaveDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm leave' }))
    expect(within(dialog).getByRole('button', { name: 'Leaving…' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Stay in group' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Close ×' })).toBeDisabled()
    const cancel = new Event('cancel', { cancelable: true })
    fireEvent(dialog, cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(dialog).toHaveAttribute('open')
    await act(async () => finish())
    expect(await screen.findByRole('button', { name: 'Join group' })).toBeInTheDocument()
    expect(rpc.mock.calls.filter(([name]) => name === 'set_organizer_membership')).toHaveLength(1)
  })
})
