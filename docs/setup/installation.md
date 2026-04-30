# Installation Guide

This guide will help you set up the StepFi API development environment on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.x or higher ([Download](https://nodejs.org/))
- **npm**: v9.x or higher (comes with Node.js)
- **Git**: Latest version ([Download](https://git-scm.com/))
- **PostgreSQL**: v14.x or higher (for local Supabase) - Optional
- **Redis**: v7.x or higher (for caching) - Optional, required for Phase 4+

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/StepFi/StepFi-API.git
cd StepFi-API
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

See [Environment Variables](./environment-variables.md) for detailed configuration options.

### 4. Supabase Setup

Follow the [Supabase Setup Guide](./supabase-setup.md) to configure your database.

### 5. Run Migrations

```bash
npm run migration:run
```

### 6. Start Development Server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

## Verification

### Check API Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-13T10:00:00.000Z"
}
```

### Access API Documentation

Open your browser and navigate to:
- Swagger UI: `http://localhost:3000/api`
- ReDoc: `http://localhost:3000/api-docs`

## Development Tools

### NestJS CLI

Install the NestJS CLI globally for easier development:

```bash
npm install -g @nestjs/cli
```

### Useful Commands

```bash
# Run in development mode with hot-reload
npm run start:dev

# Run in production mode
npm run start:prod

# Run tests
npm run test

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

## Docker Setup (Optional)

If you prefer using Docker:

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop containers
docker-compose down
```

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, change the `PORT` in your `.env` file:

```env
PORT=3001
```

### Database Connection Errors

1. Verify your Supabase credentials in `.env`
2. Check if Supabase project is active
3. Ensure your IP is allowed in Supabase settings

### Module Not Found Errors

Clear cache and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

After installation:

1. Review the [Architecture Overview](../architecture/overview.md)
2. Read the [Development Guidelines](../development/)
3. Check the [Roadmap](../../ROADMAP.md) for current development phase
4. See [Contributing Guidelines](../../CONTRIBUTING.md) to start contributing

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/)
- [Supabase Documentation](https://supabase.com/docs)

---

*Last Updated: 2026-02-13*
