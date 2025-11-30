# Suggested Development Commands

## Daily Development

### Start Development Server
```bash
npm run dev
# Starts Next.js dev server on http://localhost:3000
```

### Type Checking
```bash
npm run type-check
# Runs TypeScript compiler without emitting files
# Run this BEFORE committing code
```

### Linting
```bash
npm run lint
# Runs ESLint on codebase

npm run lint:fix
# Auto-fixes ESLint issues
```

### Formatting
```bash
npm run format
# Formats all files with Prettier

npm run format:check
# Checks if files are properly formatted (CI-friendly)
```

## Building & Production

### Build for Production
```bash
npm run build
# Runs prisma:generate + next build
# Test this BEFORE deploying
```

### Start Production Server (Local)
```bash
npm start
# Starts Next.js in production mode
# Run after npm run build
```

## Database (Prisma)

### Generate Prisma Client
```bash
npm run prisma:generate
# Regenerates Prisma Client after schema changes
# Auto-runs during npm run build
```

### Create Migration
```bash
npm run prisma:migrate
# Creates and applies a new migration in dev mode
# IMPORTANT: Only run in development environment
```

### Push Schema (No Migration)
```bash
npm run prisma:push
# Pushes schema changes directly to database
# Useful for prototyping, NOT for production
```

### Open Prisma Studio
```bash
npm run prisma:studio
# Opens Prisma Studio GUI at http://localhost:5555
# Useful for inspecting/editing database data
```

## Testing

### Unit Tests (Vitest)
```bash
npm test
# Runs Vitest in watch mode

npm run test:ui
# Opens Vitest UI in browser

npm run test:coverage
# Generates test coverage report
```

### E2E Tests (Playwright)
```bash
npm run test:e2e
# Runs Playwright E2E tests in headless mode

npm run test:e2e:ui
# Opens Playwright UI for debugging tests
```

## Git Workflow

### Check Status
```bash
git status
# Shows modified, staged, and untracked files
```

### Add Files
```bash
git add .
# Stages all changes

git add <file>
# Stages specific file
```

### Commit Changes
```bash
git commit -m "feat: Add new feature"
# Commits staged changes with message
# Use conventional commit format: feat|fix|docs|style|refactor|test|chore
```

### Push to Remote
```bash
git push origin dev
# Pushes dev branch to remote
```

## GCP & Infrastructure (Codex Territory)

### Terraform (from infra/envs/dev/)
```bash
cd infra/envs/dev
terraform plan -out dev.plan
terraform apply dev.plan
# CAUTION: Codex manages Terraform, not Claude Code
```

### Cloud Build (Manual Trigger)
```bash
gcloud builds submit --config=cloudbuild.yaml .
# Builds and pushes Docker image to Artifact Registry
```

### Cloud Run Deploy (Manual)
```bash
gcloud run deploy creative-flow-studio-dev \
  --project=dataanalyticsclinic \
  --region=asia-northeast1 \
  --image=asia-northeast1-docker.pkg.dev/dataanalyticsclinic/creative-flow-studio/app:latest \
  --service-account=cloud-run-runtime@dataanalyticsclinic.iam.gserviceaccount.com \
  --platform=managed \
  --vpc-connector=projects/dataanalyticsclinic/locations/asia-northeast1/connectors/dev-serverless-connector \
  --add-cloudsql-instances=dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql \
  --ingress=all \
  --allow-unauthenticated
# CAUTION: Should be handled by CI/CD, not manual
```

## Useful System Commands (macOS Darwin)

### File Operations
```bash
ls -la                    # List all files with details
find . -name "*.ts"       # Find TypeScript files
grep -r "search_term" .   # Search in files
cat file.txt              # Display file contents
```

### Process Management
```bash
lsof -ti:3000 | xargs kill -9  # Kill process on port 3000
ps aux | grep node             # Find Node.js processes
```

### Environment Variables
```bash
cat .env.local           # View environment variables
cp .env.example .env.local  # Copy example env file
```

## Troubleshooting

### Clear Next.js Cache
```bash
rm -rf .next
npm run build
```

### Reinstall Dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

### Reset Prisma Client
```bash
rm -rf node_modules/.prisma
npm run prisma:generate
```

### Check Port Usage
```bash
lsof -i :3000
# Shows what's using port 3000
```

## Pre-Commit Checklist Commands

Run these BEFORE committing:
```bash
npm run type-check && npm run lint && npm run format && npm test && npm run build
```

Or individually:
1. `npm run type-check` - Ensure no TypeScript errors
2. `npm run lint` - Ensure no linting errors
3. `npm run format` - Format code
4. `npm test` - Run unit tests
5. `npm run build` - Ensure build succeeds
