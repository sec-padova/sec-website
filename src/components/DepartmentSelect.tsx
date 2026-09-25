export interface DepartmentOption {
  name: string
}

interface Props {
  departments: DepartmentOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function DepartmentSelect({ departments, value, onChange, disabled = false }: Props) {
  return (
    <div className="form-field">
      <label htmlFor="department">Department <span>(optional)</span></label>
      <select
        id="department"
        name="department"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">No department (optional)</option>
        {[...departments].sort((a, b) => a.name.localeCompare(b.name)).map((department) => (
          <option key={department.name} value={department.name}>{department.name}</option>
        ))}
      </select>
    </div>
  )
}
