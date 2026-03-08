# ExampleIQ Booking Form — Skills Test

Recreation of the [booking form](https://bit.ly/4raUZ8a) with layout match, responsiveness, validation, Google Maps distance/travel time, phone recognition, and mock API submission.

## Features

- **Layout** — Matches the reference form (ExampleIQ branding, one-way/hourly, pickup/drop-off, contact, passengers, Continue).
- **Responsive** — Works on mobile and desktop; date/time and name fields stack on small screens.
- **Validation** — Required fields, email format, phone format, passenger count (1–20), and pickup date/time not in the past for one-way.
- **Google Maps** — Distance and travel time between pickup and drop-off via Routes API (server-side). Shown in the Drop off section; refreshes on address blur or “Refresh”.
- **Phone handling**
  - **Recognized number:** User is greeted by first name; no extra contact fields.
  - **Unrecognized number:** Message “We don’t have that phone number on file…” and fields for first name, last name, and email. On submit, contact is “saved” via mock save API, then booking is submitted.
- **Mock APIs**
  - `GET /api/phone/lookup?phone=...` — Returns `{ recognized, firstName? }`. Mock known numbers: `+1 774 415 3244` → Sarah, `+1 555 123 4567` → John, `+1 555 987 6543` → Maria.
  - `POST /api/phone/save` — Mock save of phone + first name, last name, email.
  - `POST /api/booking` — Mock booking submission; returns success and a booking ID.

## Setup

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd TEST-BOOKING_FORM
   npm install
   ```

2. **Google Maps API key (for distance + travel time)**

   - Create or use a Google Cloud project and enable [Routes API](https://console.cloud.google.com/apis/library/routes.googleapis.com).
   - Create an API key (optional: restrict by IP or HTTP referrer).
   - Copy `.env.local.example` to `.env.local` and set:

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local and set:
   GOOGLE_MAPS_API_KEY=your_actual_key
   ```

3. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

Without `GOOGLE_MAPS_API_KEY` or with the wrong API enabled, the distance/travel time box will show an error; enable **Routes API** (not the legacy Distance Matrix API) for your project.

## Tech Stack

- Next.js 14 (App Router), React 18, TypeScript
- Tailwind CSS
- Lucide React (icons)
- Server-side Google Routes API call from `/api/distance`

## Project Structure

```
app/
  api/
    booking/route.ts    # POST mock booking
    distance/route.ts   # GET distance + duration (Google)
    phone/
      lookup/route.ts   # GET phone recognition
      save/route.ts     # POST save new contact
  layout.tsx
  page.tsx              # Booking form UI + validation + submit
  globals.css
lib/
  validation.ts         # Validators + normalizePhone
```

## License

MIT
