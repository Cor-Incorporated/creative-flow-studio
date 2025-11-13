# Task Completion Checklist

When you complete a development task, follow this checklist to ensure quality and consistency.

## 1. Code Quality Checks

### Type Safety
```bash
npm run type-check
```
- Ensure no TypeScript errors
- Fix any type issues before proceeding

### Linting
```bash
npm run lint
```
- Fix all ESLint errors
- Address warnings if possible
- Use `npm run lint:fix` for auto-fixable issues

### Formatting
```bash
npm run format
```
- Ensure all files are properly formatted with Prettier
- Verify with `npm run format:check`

## 2. Testing

### Unit Tests
```bash
npm test
```
- Write tests for new functionality
- Ensure existing tests still pass
- Aim for meaningful test coverage

### E2E Tests (if applicable)
```bash
npm run test:e2e
```
- Update E2E tests if user-facing features changed
- Ensure critical user flows still work

## 3. Build Verification

### Production Build
```bash
npm run build
```
- **CRITICAL**: Always verify the build succeeds
- Fix any build errors before committing
- Check for console warnings

## 4. Security Review

### API Key Exposure
- NEVER use `NEXT_PUBLIC_GEMINI_API_KEY`
- Verify all Gemini API calls are server-side
- Check video downloads use proxy endpoint

### Authentication & Authorization
- Verify `getServerSession()` is used in API routes
- Ensure userId ownership checks are in place
- Test with different user sessions if applicable

### Input Validation
- Confirm Zod schemas validate all user input
- Check for potential injection vulnerabilities
- Verify file upload restrictions

## 5. Database Changes

### Prisma Schema
If you modified `prisma/schema.prisma`:
```bash
npm run prisma:generate
npm run prisma:migrate
```
- Create migration in dev environment
- Update Zod validators if JSON fields changed
- Test database operations

### Data Integrity
- Verify foreign key relationships
- Check cascade delete behavior
- Test with sample data

## 6. Documentation

### Code Comments
- Add JSDoc comments for exported functions
- Document complex logic
- Update inline comments if behavior changed

### CLAUDE.md
- Update if architecture changed
- Add new API routes to documentation
- Update "What's Been Completed" section
- Adjust "What's Next" priorities

### API Documentation
- Document new endpoints in `docs/api-design-*.md`
- Include request/response examples
- Note authentication requirements

## 7. Git Best Practices

### Review Changes
```bash
git status
git diff
```
- Review all modified files
- Ensure no unintended changes
- Check for leftover console.logs or debug code

### Commit Message
Use conventional commit format:
```
<type>: <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

Example:
```bash
git add .
git commit -m "feat: Implement conversation persistence API endpoints"
```

### Pre-Push Checks
```bash
npm run type-check && npm run lint && npm run build
```
- Run all checks one final time
- Ensure tests pass
- Verify build succeeds

## 8. Special Considerations

### DJ Shacho Mode
- Test with DJ Shacho Mode enabled/disabled
- Verify error messages convert properly
- Check initial greeting changes

### Memory Management
- Verify blob URLs are tracked and cleaned up
- Check for memory leaks in useEffect hooks
- Test with large conversation histories

### Mobile Responsiveness
- Test UI on mobile viewport sizes
- Verify touch interactions work
- Check responsive layout breakpoints

## 9. Environment-Specific

### Local Development
- Test in browser at http://localhost:3000
- Check browser console for errors
- Verify network tab shows correct API calls

### Cloud Run (Production)
- Codex handles deployment (not Claude Code)
- Ensure `.env.example` is up to date
- Document any new environment variables

## 10. Communication

### Update Status
- Update todo list with completed tasks
- Note any blockers or issues encountered
- Suggest next steps if applicable

### Ask for Review (if needed)
- Complex changes may need user review
- Highlight architectural decisions
- Explain trade-offs made

---

## Quick Pre-Commit Command

Run this single command to check everything:
```bash
npm run type-check && npm run lint && npm run format && npm test && npm run build
```

If all pass, you're ready to commit!
