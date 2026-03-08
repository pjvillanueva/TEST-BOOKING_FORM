import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY

export async function GET(request: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: 'Google Maps API key not configured. Set GOOGLE_MAPS_API_KEY in .env.local' },
      { status: 503 }
    )
  }
  const origin = request.nextUrl.searchParams.get('origin')
  const destination = request.nextUrl.searchParams.get('destination')
  if (!origin?.trim() || !destination?.trim()) {
    return NextResponse.json(
      { error: 'origin and destination are required' },
      { status: 400 }
    )
  }

  const url = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix'
  const body = {
    origins: [{ waypoint: { address: origin.trim() } }],
    destinations: [{ waypoint: { address: destination.trim() } }],
    travelMode: 'DRIVE',
    units: 'IMPERIAL',
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask':
        'originIndex,destinationIndex,status,condition,distanceMeters,duration,localizedValues',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    let errMsg = `Routes API error: ${res.status}`
    try {
      const j = JSON.parse(text)
      if (j.error?.message) errMsg = j.error.message
    } catch {
      if (text) errMsg = text.slice(0, 300)
    }
    return NextResponse.json({ error: errMsg }, { status: 502 })
  }

  const text = await res.text()
  let element: {
    status?: { code?: number; message?: string }
    condition?: string
    distanceMeters?: number
    duration?: string
    localizedValues?: { distance?: { text?: string }; duration?: { text?: string } }
  } | null = null

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed) && parsed[0]) {
      element = parsed[0]
    } else if (parsed && typeof parsed === 'object') {
      element = parsed
    }
  } catch {
    const firstLine = text.trim().split('\n')[0]
    if (firstLine) {
      try {
        element = JSON.parse(firstLine)
      } catch {
        /* ignore */
      }
    }
  }

  if (!element) {
    return NextResponse.json(
      { error: 'Route not found or could not be calculated' },
      { status: 404 }
    )
  }

  if (element.status?.code !== 0 && element.status?.code !== undefined) {
    return NextResponse.json(
      {
        error:
          element.status.message ||
          'Route could not be calculated',
      },
      { status: 404 }
    )
  }

  if (element.condition !== 'ROUTE_EXISTS' || element.distanceMeters == null) {
    return NextResponse.json(
      { error: 'Route not found or could not be calculated' },
      { status: 404 }
    )
  }

  const distanceMeters = element.distanceMeters
  const distanceMiles = distanceMeters / 1609.34
  const distanceText =
    element.localizedValues?.distance?.text || `${Math.round(distanceMiles)} mi`

  let durationSeconds = 0
  if (element.duration) {
    const match = element.duration.match(/^(\d+(?:\.\d+)?)s$/)
    if (match) durationSeconds = parseFloat(match[1])
  }
  const durationText =
    element.localizedValues?.duration?.text ||
    (durationSeconds >= 3600
      ? `${Math.floor(durationSeconds / 3600)} hr ${Math.round((durationSeconds % 3600) / 60)} min`
      : `${Math.round(durationSeconds / 60)} min`)

  return NextResponse.json({
    distance: { text: distanceText, value: Math.round(distanceMeters) },
    duration: { text: durationText, value: Math.round(durationSeconds) },
  })
}
