# CLAUDE.md

## Git Configuration

- Use `iam-dev` as the git commit author name
- Use `affiliaps@gmail.com` as the git commit email

## Pre-Commit Checks

Husky is configured to automatically run lint and type-check before each commit.

The pre-commit hook runs:
```bash
# Backend
cd backend && npm run lint && npx tsc --noEmit

# Frontend  
cd frontend && npm run lint && npm run type-check
```

To skip pre-commit hooks (not recommended): `git commit --no-verify`
