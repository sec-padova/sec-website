import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MemberDirectory from './MemberDirectory'

describe('member directory', () => {
  it('shows only valid members in name order and rejects unsafe profile links', () => {
    render(<MemberDirectory members={[
      { name: 'Zoe Example', department: 'Design', github: 'javascript:alert(1)' },
      { name: 'Ada Example', github: 'https://github.com/ada-example' },
      { name: '  ' },
    ]} />)

    expect(screen.getByText('2 members')).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Ada Example')
    expect(rows[1]).toHaveTextContent('Zoe Example')
    expect(screen.getByRole('link', { name: /ada example on github/i })).toHaveAttribute('href', 'https://github.com/ada-example')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })
})
