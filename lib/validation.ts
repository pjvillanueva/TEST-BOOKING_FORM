export type ValidationResult = { valid: true } | { valid: false; message: string }

const required = (value: string | undefined, fieldName: string): ValidationResult =>
  value?.trim() ? { valid: true } : { valid: false, message: `${fieldName} is required` }

const email = (value: string | undefined): ValidationResult => {
  if (!value?.trim()) return { valid: false, message: 'Email is required' }
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(value.trim()) ? { valid: true } : { valid: false, message: 'Enter a valid email' }
}

const phone = (value: string | undefined): ValidationResult => {
  if (!value?.trim()) return { valid: false, message: 'Phone number is required' }
  const digits = value.replace(/\D/g, '')
  if (digits.length < 10) return { valid: false, message: 'Enter a valid phone number' }
  return { valid: true }
}

const passengers = (value: number | undefined): ValidationResult => {
  if (value == null || value === undefined) return { valid: false, message: 'Number of passengers is required' }
  const n = Number(value)
  if (Number.isNaN(n) || n < 1) return { valid: false, message: 'At least 1 passenger required' }
  if (n > 20) return { valid: false, message: 'Maximum 20 passengers' }
  return { valid: true }
}

const dateNotInPast = (dateStr: string, timeStr: string): ValidationResult => {
  if (!dateStr?.trim() || !timeStr?.trim()) return { valid: true } // let required handle it
  const date = new Date(`${dateStr}T${timeStr}`)
  if (Number.isNaN(date.getTime())) return { valid: false, message: 'Invalid date or time' }
  if (date < new Date()) return { valid: false, message: 'Pickup must be in the future' }
  return { valid: true }
}

export const validators = {
  required,
  email,
  phone,
  passengers,
  dateNotInPast,
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return value.trim()
}
