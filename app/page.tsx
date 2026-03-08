'use client'

import { useState, useCallback } from 'react'
import Script from 'next/script'
import {
  Clock,
  ArrowRight,
  User,
  Calendar,
  MapPin,
  Mail,
  Hash,
  Loader2,
} from 'lucide-react'
import { validators, normalizePhone } from '@/lib/validation'
import type { BookingPayload } from '@/app/api/booking/route'
import PlaceAutocomplete from '@/components/PlaceAutocomplete'

type FormErrors = Partial<Record<string, string>>

export default function BookingForm() {
  const [bookingType, setBookingType] = useState<'one-way' | 'hourly'>('one-way')
  const [pickupLocationType, setPickupLocationType] = useState<'location' | 'airport'>('location')
  const [dropoffLocationType, setDropoffLocationType] = useState<'location' | 'airport'>('location')

  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')

  const [phone, setPhone] = useState('')
  const [phoneRecognized, setPhoneRecognized] = useState<boolean | null>(null)
  const [recognizedFirstName, setRecognizedFirstName] = useState<string | null>(null)
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')

  const [passengers, setPassengers] = useState<number | ''>('')

  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [distance, setDistance] = useState<{ text: string; value: number } | null>(null)
  const [duration, setDuration] = useState<{ text: string; value: number } | null>(null)
  const [distanceLoading, setDistanceLoading] = useState(false)
  const [distanceError, setDistanceError] = useState<string | null>(null)
  const [placesScriptReady, setPlacesScriptReady] = useState(false)
  const placesApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const fetchDistance = useCallback(async (overrides?: { origin?: string; destination?: string }) => {
    const origin = (overrides?.origin ?? pickupAddress).trim()
    const destination = (overrides?.destination ?? dropoffAddress).trim()
    if (!origin || !destination) return
    setDistanceLoading(true)
    setDistanceError(null)
    try {
      const params = new URLSearchParams({ origin, destination })
      const res = await fetch(`/api/distance?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setDistanceError(data.error || 'Could not get distance')
        setDistance(null)
        setDuration(null)
        return
      }
      setDistance(data.distance ?? null)
      setDuration(data.duration ?? null)
    } catch {
      setDistanceError('Network error')
      setDistance(null)
      setDuration(null)
    } finally {
      setDistanceLoading(false)
    }
  }, [pickupAddress, dropoffAddress])

  const lookupPhone = useCallback(async (phoneValue: string) => {
    const normalized = normalizePhone(phoneValue)
    if (normalized.length < 10) {
      setPhoneRecognized(null)
      setRecognizedFirstName(null)
      return
    }
    setPhoneLookupLoading(true)
    setPhoneRecognized(null)
    setRecognizedFirstName(null)
    try {
      const res = await fetch(`/api/phone/lookup?phone=${encodeURIComponent(phoneValue)}`)
      const data = await res.json()
      setPhoneRecognized(data.recognized === true)
      setRecognizedFirstName(data.firstName ?? null)
    } catch {
      setPhoneRecognized(false)
    } finally {
      setPhoneLookupLoading(false)
    }
  }, [])

  const validate = (): boolean => {
    const next: FormErrors = {}

    const rDate = validators.required(pickupDate, 'Pickup date')
    if (!rDate.valid) next.pickupDate = rDate.message

    const rTime = validators.required(pickupTime, 'Pickup time')
    if (!rTime.valid) next.pickupTime = rTime.message

    if (bookingType === 'one-way') {
      const rPast = validators.dateNotInPast(pickupDate, pickupTime)
      if (!rPast.valid) next.pickupDate = rPast.message
    }

    const rPickup = validators.required(pickupAddress, 'Pickup location')
    if (!rPickup.valid) next.pickupAddress = rPickup.message

    const rDropoff = validators.required(dropoffAddress, 'Drop off location')
    if (!rDropoff.valid) next.dropoffAddress = rDropoff.message

    const rPhone = validators.phone(phone)
    if (!rPhone.valid) next.phone = rPhone.message

    if (phoneRecognized === false) {
      const rFirst = validators.required(firstName, 'First name')
      if (!rFirst.valid) next.firstName = rFirst.message
      const rLast = validators.required(lastName, 'Last name')
      if (!rLast.valid) next.lastName = rLast.message
      const rEmail = validators.email(email)
      if (!rEmail.valid) next.email = rEmail.message
    }

    const rPass = validators.passengers(passengers === '' ? undefined : passengers)
    if (!rPass.valid) next.passengers = rPass.message

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      if (phoneRecognized === false) {
        const saveRes = await fetch('/api/phone/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: normalizePhone(phone),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
          }),
        })
        if (!saveRes.ok) {
          const d = await saveRes.json().catch(() => ({}))
          setSubmitError(d.error || 'Failed to save contact')
          setSubmitting(false)
          return
        }
      }

      const payload: BookingPayload = {
        bookingType,
        pickup: {
          date: pickupDate,
          time: pickupTime,
          locationType: pickupLocationType,
          address: pickupAddress.trim(),
        },
        dropoff: {
          locationType: dropoffLocationType,
          address: dropoffAddress.trim(),
        },
        contact: {
          phone: normalizePhone(phone),
          ...(phoneRecognized === false ? { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() } : {}),
        },
        passengers: Number(passengers),
        ...(distance && { distance }),
        ...(duration && { duration }),
      }

      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error || 'Booking failed')
        return
      }
      setSubmitSuccess(true)
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="mx-auto max-w-xl text-center">
          <div className="rounded-full bg-green-100 p-4 w-16 h-16 mx-auto flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Booking received</h2>
          <p className="text-gray-600">We&apos;ll confirm your trip shortly.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        <header className="mb-6 sm:mb-8 flex justify-center">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
              <Clock className="h-5 w-5 text-gray-900" />
            </div>
            <span className="text-xl font-semibold text-gray-900">ExampleIQ</span>
          </div>
        </header>

        <h1 className="mb-6 text-center text-xl sm:text-2xl font-bold text-gray-900">
          Let&apos;s get you on your way!
        </h1>

        {placesApiKey && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${placesApiKey}&loading=async`}
            strategy="afterInteractive"
            onLoad={() => setPlacesScriptReady(true)}
          />
        )}

        <div className="mb-6 sm:mb-8 flex rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setBookingType('one-way')}
            className={`segment-btn ${bookingType === 'one-way' ? 'active' : ''}`}
          >
            <ArrowRight className="h-4 w-4 shrink-0" />
            <span className="truncate">One-way</span>
          </button>
          <button
            type="button"
            onClick={() => setBookingType('hourly')}
            className={`segment-btn ${bookingType === 'hourly' ? 'active' : ''}`}
          >
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate">Hourly</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          {/* Pickup */}
          <section>
            <h2 className="mb-4 text-lg font-bold text-gray-900">Pickup</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    className={`input-base input-with-leading-icon ${errors.pickupDate ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    aria-invalid={!!errors.pickupDate}
                    aria-describedby={errors.pickupDate ? 'err-pickupDate' : undefined}
                  />
                  {errors.pickupDate && (
                    <p id="err-pickupDate" className="mt-1 text-sm text-red-600">{errors.pickupDate}</p>
                  )}
                </div>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="time"
                    className={`input-base input-with-leading-icon ${errors.pickupTime ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    aria-invalid={!!errors.pickupTime}
                  />
                  {errors.pickupTime && (
                    <p className="mt-1 text-sm text-red-600">{errors.pickupTime}</p>
                  )}
                </div>
              </div>
              <div className="flex rounded-xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setPickupLocationType('location')}
                  className={`segment-btn ${pickupLocationType === 'location' ? 'active' : ''}`}
                >
                  Location
                </button>
                <button
                  type="button"
                  onClick={() => setPickupLocationType('airport')}
                  className={`segment-btn ${pickupLocationType === 'airport' ? 'active' : ''}`}
                >
                  Airport
                </button>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-500">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none z-10" aria-hidden />
                  <PlaceAutocomplete
                    value={pickupAddress}
                    onChange={setPickupAddress}
                    onBlur={(selectedAddress) => fetchDistance(selectedAddress ? { origin: selectedAddress } : undefined)}
                    placeholder="Address or place name"
                    className={`input-base input-with-leading-icon pr-10 ${errors.pickupAddress ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                    aria-invalid={!!errors.pickupAddress}
                    scriptReady={placesScriptReady}
                  />
                  <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {errors.pickupAddress && (
                  <p className="mt-1 text-sm text-red-600">{errors.pickupAddress}</p>
                )}
              </div>
              <button type="button" className="text-sm font-medium text-accent-dark hover:text-accent-dark/80">
                + Add a stop
              </button>
            </div>
          </section>

          {/* Drop off */}
          <section>
            <h2 className="mb-4 text-lg font-bold text-gray-900">Drop off</h2>
            <div className="space-y-4">
              <div className="flex rounded-xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setDropoffLocationType('location')}
                  className={`segment-btn ${dropoffLocationType === 'location' ? 'active' : ''}`}
                >
                  Location
                </button>
                <button
                  type="button"
                  onClick={() => setDropoffLocationType('airport')}
                  className={`segment-btn ${dropoffLocationType === 'airport' ? 'active' : ''}`}
                >
                  Airport
                </button>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-500">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none z-10" aria-hidden />
                  <PlaceAutocomplete
                    value={dropoffAddress}
                    onChange={setDropoffAddress}
                    onBlur={(selectedAddress) => fetchDistance(selectedAddress ? { destination: selectedAddress } : undefined)}
                    placeholder="Address or place name"
                    className={`input-base input-with-leading-icon pr-10 ${errors.dropoffAddress ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                    aria-invalid={!!errors.dropoffAddress}
                    scriptReady={placesScriptReady}
                  />
                  <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {errors.dropoffAddress && (
                  <p className="mt-1 text-sm text-red-600">{errors.dropoffAddress}</p>
                )}
              </div>
              {/* Distance & travel time */}
              {(pickupAddress.trim() && dropoffAddress.trim()) && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  {distanceLoading ? (
                    <span className="flex items-center gap-2 text-sm text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Getting distance…
                    </span>
                  ) : distanceError ? (
                    <p className="text-sm text-amber-700">{distanceError}</p>
                  ) : (distance || duration) ? (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Distance:</span> {distance?.text ?? '—'}
                      {duration && (
                        <>
                          {' · '}
                          <span className="font-medium">Travel time:</span> {duration.text}
                        </>
                      )}
                    </p>
                  ) : null}
                  {!distanceLoading && !distanceError && (distance || duration) && (
                    <button
                      type="button"
                      onClick={() => fetchDistance()}
                      className="mt-2 text-xs text-accent-dark hover:underline"
                    >
                      Refresh
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="mb-4 text-lg font-bold text-gray-900">Contact Information</h2>
            <div className="space-y-4">
              {phoneRecognized === true && recognizedFirstName && (
                <p className="text-base font-medium text-gray-900">
                  Hi, {recognizedFirstName}!
                </p>
              )}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg" aria-hidden>🇺🇸</span>
                <input
                  type="tel"
                  className={`input-base input-with-leading-icon-phone ${errors.phone ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    if (phoneRecognized !== null) {
                      lookupPhone(e.target.value)
                    }
                  }}
                  onBlur={() => lookupPhone(phone)}
                  aria-invalid={!!errors.phone}
                />
                {phoneLookupLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </span>
                )}
              </div>
              {errors.phone && (
                <p className="text-sm text-red-600">{errors.phone}</p>
              )}
              {phoneRecognized === false && (
                <>
                  <p className="text-sm text-gray-500">
                    We don&apos;t have that phone number on file. Please provide additional contact information.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="First name"
                        className={`input-base input-with-leading-icon ${errors.firstName ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        aria-invalid={!!errors.firstName}
                      />
                      {errors.firstName && (
                        <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                      )}
                    </div>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Last name"
                        className={`input-base input-with-leading-icon ${errors.lastName ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        aria-invalid={!!errors.lastName}
                      />
                      {errors.lastName && (
                        <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="name@example.com"
                      className={`input-base input-with-leading-icon ${errors.email ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={!!errors.email}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Passengers */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-gray-900">
              How many passengers are expected for the trip?
            </h2>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="number"
                min={1}
                max={20}
                placeholder="# Passengers"
                className={`input-base input-with-leading-icon ${errors.passengers ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                value={passengers === '' ? '' : passengers}
                onChange={(e) => setPassengers(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                aria-invalid={!!errors.passengers}
              />
            </div>
            {errors.passengers && (
              <p className="mt-1 text-sm text-red-600">{errors.passengers}</p>
            )}
          </section>

          {submitError && (
            <p className="text-sm text-red-600 rounded-lg bg-red-50 p-3">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-accent py-4 text-base font-semibold text-gray-900 transition-colors hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Submitting…
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
