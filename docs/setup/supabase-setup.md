# Supabase Setup

This project uses **Supabase remote instance only**. You must have a Supabase project set up at [supabase.com](https://supabase.com).

## Get Your Project Credentials

1. Go to your project on [supabase.com](https://supabase.com)
2. Navigate to **Settings → API**
3. Copy the following:
   - **Project URL** → Use for `SUPABASE_URL`
   - **anon public key** → Use for `SUPABASE_ANON_KEY`
   - **service_role secret key** → Use for `SUPABASE_SERVICE_ROLE_KEY`

## Configure Environment Variables

Update your `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Access Dashboard

Go to your project dashboard on supabase.com

## Migrations

**Note**: Migrations require Supabase CLI. Install it and login:

```bash
npm install -g supabase
supabase login
```

### Link Your Project

Before creating or applying migrations, link your local project to your remote Supabase project:

```bash
supabase link --project-ref your-project-ref
```

You can find your project ref in your Supabase project settings (Settings → General → Reference ID).

### Create Migration

```bash
supabase migration new migration_name
```

This creates a new file in `supabase/migrations/` with format: `YYYYMMDDHHMMSS_migration_name.sql`

### Apply Migrations

```bash
supabase db push
```

This applies migrations to your remote Supabase project.

### Revert Migration

```bash
supabase migration repair --status reverted migration_name
```

## Migration Structure

- Files in `supabase/migrations/`
- Format: `YYYYMMDDHHMMSS_migration_name.sql`
- Use transactions when possible

## Connection

### Environment Variables
```env
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Client
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
```

## Useful Links

- Dashboard: Your project URL on supabase.com
- API URL: Your project API URL
- Documentation: [supabase.com/docs](https://supabase.com/docs)
