export interface PublicMember {
  name: string
  department?: string
  github?: string
}

interface Props {
  members: PublicMember[]
}

function githubUrl(value?: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'github.com' && url.pathname.length > 1
      ? url.href
      : null
  } catch {
    return null
  }
}

export default function MemberDirectory({ members }: Props) {
  const entries = members
    .filter((member) => typeof member?.name === 'string' && member.name.trim())
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <details className="member-directory">
      <summary>
        <span>Explore the member directory</span>
        <span className="directory-summary-end">
          <span id="member-count">{entries.length ? `${entries.length} ${entries.length === 1 ? 'member' : 'members'}` : 'Names coming soon'}</span>
          <span className="directory-toggle" aria-hidden="true">+</span>
        </span>
      </summary>
      <div className="directory-panel">
        <p>{entries.length ? 'Meet the members who chose to be featured.' : 'The club roster is being prepared. Names will appear here as members choose to be featured.'}</p>
        <div className="member-scroll" role="region" aria-label="Club member list" tabIndex={0}>
          <ul className="member-list" id="member-list">
            {entries.length ? entries.map((member) => {
              const name = member.name.trim()
              const github = githubUrl(member.github)
              return (
                <li className="member-row" key={name}>
                  <span className="member-mark" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
                  <span className="member-identity">
                    <strong>{name}</strong>
                    {member.department?.trim() && <small>{member.department.trim()}</small>}
                  </span>
                  {github && <a href={github} target="_blank" rel="noopener noreferrer" aria-label={`${name} on GitHub (opens in a new tab)`}>GitHub ↗</a>}
                </li>
              )
            }) : Array.from({ length: 8 }, (_, index) => (
              <li className="member-row placeholder-row" key={index}>
                <span className="member-mark" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="member-identity"><strong>Member name coming soon</strong></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  )
}
