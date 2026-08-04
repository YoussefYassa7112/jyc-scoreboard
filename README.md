# Camp Scoreboard

Toy Story–inspired live camp scoreboard. Kids scan a QR code to view animated standings. Staff log in to create teams and add or deduct points.

**Live app:** [https://camp-scoreboard.vercel.app](https://camp-scoreboard.vercel.app)  
**Admin pannel:** [https://camp-scoreboard.vercel.app](https://camp-scoreboard.vercel.app/admin/login)

**Repo:** [YoussefYassa7112/jyc-scoreboard](https://github.com/YoussefYassa7112/jyc-scoreboard)

Pushes to `main` automatically deploy to Vercel production.

**Free stack:** Next.js · Neon Postgres · Vercel

## Features

- Public animated leaderboard (`/`) with auto-refresh every 3 seconds
- Admin login (`/admin/login`) with password + signed cookie
- Dynamic teams (create, rename, delete when unused)
- Add / deduct points with optional notes and history
- Downloadable QR code pointing at the public scoreboard
- Responsive for phones, tablets, and desktop / TV

## Quick start (local)

1. Create a free Neon database at [neon.tech](https://neon.tech) and copy the connection string.

2. Copy env file and fill values:

```bash
cp .env.example .env.local
# Windows PowerShell: Copy-Item .env.example .env.local
```

```env
DATABASE_URL=postgresql://...
ADMIN_PASSWORD=your-camp-password
AUTH_SECRET=a-long-random-string
```

3. Install and push the schema:

```bash
npm install
npm run db:push
```

4. Run the app:

```bash
npm run dev
```

- Scoreboard: [http://localhost:3000](http://localhost:3000)
- Admin: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

## Deploy on Vercel (free)

1. Push this repo to GitHub.
2. Import the project in [vercel.com](https://vercel.com).
3. Add a **Neon** database from the Vercel Marketplace (or paste an existing `DATABASE_URL`).
4. Set environment variables:
   - `DATABASE_URL`
   - `ADMIN_PASSWORD`
   - `AUTH_SECRET` (generate any long random string)
5. Deploy.
6. After the first deploy, run migrations against production:

```bash
# with DATABASE_URL set to the Neon production URL
npm run db:push
```

Or open the Neon SQL editor and paste the contents of `drizzle/0000_init.sql`.

7. Open `/admin/login`, create teams, then download the QR from the admin dashboard and print it for campers.

## Camper vs admin

| Who | URL | Can do |
|-----|-----|--------|
| Campers | `/` (via QR) | View live standings only |
| Staff | `/admin` | Manage teams, add/deduct points, view history, download QR |

## Project structure

```
src/
  app/                 # Pages + API routes
  components/          # Scoreboard + admin UI
  db/                  # Drizzle schema + client
  lib/                 # Auth + standings helpers
drizzle/               # SQL migration
```

## Notes

- Schedule module is deferred (scoreboard only for v1).
- Theme is Toy Story–inspired; no official Disney assets are included.
- Deleting a team is blocked if it already has point history — rename instead.
