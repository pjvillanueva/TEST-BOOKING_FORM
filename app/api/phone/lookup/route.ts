import { NextRequest, NextResponse } from 'next/server'

// Mock: known numbers with first names (in production this would be a DB lookup)
const KNOWN_PHONES: Record<string, string> = {
  '17744153244': 'Sarah',
  '15551234567': 'John',
  '15559876543': 'Maria',
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^1/, '')
}

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get('phone')
  if (!phone?.trim()) {
    return NextResponse.json({ error: 'Phone required' }, { status: 400 })
  }
  const key = normalizePhone(phone)
  const firstName = KNOWN_PHONES[key]
  return NextResponse.json({
    recognized: !!firstName,
    firstName: firstName ?? undefined,
  })
}
