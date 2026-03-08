import { NextRequest, NextResponse } from 'next/server'

export type BookingPayload = {
  bookingType: 'one-way' | 'hourly'
  pickup: { date: string; time: string; locationType: string; address: string }
  dropoff: { locationType: string; address: string }
  contact: {
    phone: string
    firstName?: string
    lastName?: string
    email?: string
  }
  passengers: number
  distance?: { text: string; value: number }
  duration?: { text: string; value: number }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BookingPayload
    // Mock: validate shape and return success
    if (!body?.pickup?.address || !body?.dropoff?.address || !body?.contact?.phone || body?.passengers == null) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    // In a real app we would persist to a database here
    return NextResponse.json({
      success: true,
      message: 'Booking received successfully',
      bookingId: `BK-${Date.now()}`,
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    )
  }
}
