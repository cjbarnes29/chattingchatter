import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  label?: string
  className?: string
  wrapClassName?: string
  autoComplete?: string
  inputMode?: 'numeric' | 'text'
  maxLength?: number
  autoFocus?: boolean
  required?: boolean
  /** a leading icon, shown inside the field */
  leading?: React.ReactNode
}

/** A password / PIN field with a show-hide eye, so people can check what they typed. */
export default function SecretInput({ value, onChange, placeholder, label, className = '', wrapClassName = '', autoComplete = 'off', inputMode, maxLength, autoFocus, required, leading }: Props) {
  const [shown, setShown] = useState(false)
  return (
    <span className={`relative flex items-center ${wrapClassName}`}>
      {leading}
      <input
        type={shown ? 'text' : 'password'}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete={autoComplete}
        maxLength={maxLength}
        autoFocus={autoFocus}
        required={required}
        className={`${className} min-w-0 flex-1 pr-10`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? `Hide ${label ?? 'password'}` : `Show ${label ?? 'password'}`}
        aria-pressed={shown}
        className="absolute right-2 rounded-full p-1.5 text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-primary))]"
      >
        {shown ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </span>
  )
}
