# CLAUDE.md

## Git Configuration

- Use `iam-dev` as the git commit author name
- Use `affiliaps@gmail.com` as the git commit email

## Pre-Commit Hooks (Husky)

Husky is configured with automatic checks:

### Pre-commit (runs on every commit)
- Backend: `npm run lint && tsc --noEmit`
- Frontend: `npm run lint && npm run type-check`

### Pre-push (runs before push)
- Backend: `npm run test`
- Frontend: `npm run test`

To skip hooks (not recommended): `git commit --no-verify` or `git push --no-verify`
