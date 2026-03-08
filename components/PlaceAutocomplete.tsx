'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

type PlaceSuggestion = {
  placePrediction: {
    text: { toString: () => string }
    toPlace: () => { fetchFields: (opts: { fields: string[] }) => Promise<void>; formattedAddress?: string }
  }
}

type PlaceAutocompleteProps = {
  value: string
  onChange: (value: string) => void
  onBlur?: (selectedAddress?: string) => void
  placeholder?: string
  className?: string
  'aria-invalid'?: boolean
  id?: string
  scriptReady?: boolean
}

export default function PlaceAutocomplete({
  value,
  onChange,
  onBlur,
  placeholder = 'Address or place name',
  className = '',
  'aria-invalid': ariaInvalid,
  id,
  scriptReady = false,
}: PlaceAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [placesReady, setPlacesReady] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const sessionTokenRef = useRef<unknown>(null)
  const justSelectedRef = useRef(false)
  const placesLibRef = useRef<{
    AutocompleteSuggestion: { fetchAutocompleteSuggestions: (req: { input: string; sessionToken?: unknown }) => Promise<{ suggestions: PlaceSuggestion[] }> }
    AutocompleteSessionToken: new () => unknown
  } | null>(null)

  // Load places library (retry if importLibrary not ready yet with loading=async)
  useEffect(() => {
    if (!scriptReady) return
    let cancelled = false
    const tryLoad = () => {
      const w = window as Window & { google?: { maps: { importLibrary: (n: string) => Promise<unknown> } } }
      if (!w.google?.maps?.importLibrary) {
        if (!cancelled) setTimeout(tryLoad, 100)
        return
      }
      w.google.maps.importLibrary('places').then((lib: unknown) => {
        if (cancelled) return
        const pl = lib as { AutocompleteSuggestion?: { fetchAutocompleteSuggestions: (req: { input: string; sessionToken?: unknown }) => Promise<{ suggestions: PlaceSuggestion[] }> }; AutocompleteSessionToken?: new () => unknown }
        if (pl.AutocompleteSuggestion && pl.AutocompleteSessionToken) {
          placesLibRef.current = {
            AutocompleteSuggestion: pl.AutocompleteSuggestion,
            AutocompleteSessionToken: pl.AutocompleteSessionToken,
          }
          sessionTokenRef.current = new pl.AutocompleteSessionToken()
          setPlacesReady(true)
        }
      }).catch(() => {
        if (!cancelled) setTimeout(tryLoad, 200)
      })
    }
    tryLoad()
    return () => { cancelled = true }
  }, [scriptReady])

  const fetchSuggestions = useCallback(async (input: string) => {
    const lib = placesLibRef.current
    const trimmed = input.trim()
    if (!lib || !trimmed || trimmed.length < 2) {
      setSuggestions([])
      return
    }
    setLoading(true)
    try {
      const token = sessionTokenRef.current ?? new lib.AutocompleteSessionToken()
      const res = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: trimmed,
        sessionToken: token,
      })
      const list = Array.isArray(res?.suggestions) ? res.suggestions : []
      setSuggestions(list as PlaceSuggestion[])
      setIsOpen(list.length > 0)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced fetch on value change (skip right after selecting a place)
  useEffect(() => {
    if (!placesReady) return
    if (justSelectedRef.current) {
      justSelectedRef.current = false
      setSuggestions([])
      setIsOpen(false)
      return
    }
    if (!value.trim() || value.trim().length < 2) {
      setSuggestions([])
      setIsOpen(false)
      return
    }
    const t = setTimeout(() => fetchSuggestions(value), 300)
    return () => clearTimeout(t)
  }, [value, fetchSuggestions, placesReady])

  const handleSelect = useCallback(
    async (suggestion: PlaceSuggestion) => {
      justSelectedRef.current = true
      try {
        const place = suggestion.placePrediction.toPlace()
        await place.fetchFields({ fields: ['formattedAddress'] })
        const addr = place.formattedAddress ?? suggestion.placePrediction.text.toString()
        onChange(addr)
        onBlur?.(addr)
        setSuggestions([])
        setIsOpen(false)
        sessionTokenRef.current = placesLibRef.current ? new placesLibRef.current.AutocompleteSessionToken() : null
      } catch {
        const text = suggestion.placePrediction.text.toString()
        onChange(text)
        onBlur?.(text)
        setSuggestions([])
        setIsOpen(false)
      }
    },
    [onChange, onBlur]
  )

  const handleBlur = useCallback(() => {
    onBlur?.()
    setTimeout(() => setIsOpen(false), 200)
  }, [onBlur])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        aria-invalid={ariaInvalid}
        id={id}
        autoComplete="off"
        aria-expanded={isOpen}
        aria-controls={id ? `${id}-listbox` : undefined}
      />
      {isOpen && suggestions.length > 0 && (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[9999] mt-1 max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((suggestion, i) => (
            <li
              key={i}
              role="option"
              className="cursor-pointer px-4 py-2.5 text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(suggestion)
              }}
            >
              {suggestion?.placePrediction?.text != null
                ? typeof suggestion.placePrediction.text === 'string'
                  ? suggestion.placePrediction.text
                  : (suggestion.placePrediction.text as { toString?: () => string }).toString?.() ?? ''
                : ''}
            </li>
          ))}
        </ul>
      )}
      {loading && value.trim() && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
      )}
    </div>
  )
}
