import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DepartmentSelect from './DepartmentSelect'

describe('department selection', () => {
  it('offers an optional blank value and only the supplied UniPd departments', () => {
    const onChange = vi.fn()
    render(<DepartmentSelect value="" onChange={onChange} departments={[
      { name: 'Department of Information Engineering - DEI' },
      { name: 'Department of Biology - DiBio' },
    ]} />)

    const select = screen.getByRole('combobox', { name: /department/i })
    expect(select).not.toBeRequired()
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByRole('option', { name: /optional/i })).toHaveValue('')

    fireEvent.change(select, { target: { value: 'Department of Biology - DiBio' } })
    expect(onChange).toHaveBeenCalledWith('Department of Biology - DiBio')
  })
})
