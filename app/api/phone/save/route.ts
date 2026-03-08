import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, firstName, lastName, email } = body ?? {}
    if (!phone?.trim() || !firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Phone, first name, last name, and email are required' },
        { status: 400 }
      )
    }
    // Mock: in production we would save to a database
    return NextResponse.json({
      success: true,
      message: 'Contact saved',
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    )
  }
}
