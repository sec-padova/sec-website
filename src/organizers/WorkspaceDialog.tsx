import { useEffect, useRef, useState, type ReactNode } from 'react'

export default function WorkspaceDialog({ open, title, id, onClose, refresh, notice, dismissDisabled = false, descriptionId, children }: {
  open: boolean
  title: string
  id: string
  onClose: () => void
  refresh?: () => Promise<void>
  notice?: string
  dismissDisabled?: boolean
  descriptionId?: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    else if (!open && element.open) element.close()
  }, [open])

  return <dialog ref={dialog} className="workspace-dialog" aria-labelledby={id} aria-describedby={descriptionId} onCancel={event => {
    if (dismissDisabled) event.preventDefault()
    else onClose()
  }} onClose={onClose}>
    <header className="workspace-dialog-header"><h2 id={id}>{title}</h2><div className="workspace-actions">
      {refresh && <button type="button" className="workspace-text-button" disabled={refreshing} onClick={async () => {
        setRefreshing(true)
        try { await refresh() }
        finally { setRefreshing(false) }
      }}>{refreshing ? 'Refreshing…' : 'Refresh details'}</button>}
      <button type="button" className="workspace-button workspace-button-small" disabled={dismissDisabled} onClick={onClose}>Close ×</button>
    </div></header>
    <div className="workspace-dialog-content">{notice && <p className="workspace-notice" role="alert">{notice}</p>}{children}</div>
  </dialog>
}
