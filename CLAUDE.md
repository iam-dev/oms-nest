# CLAUDE.md — Dirigent 🎼 v2

**One command. Intelligent workflows. Multi-agent collaboration.**

```
/dirigent <what you want>
```

Dirigent now features intelligent workflow detection and multi-agent collaboration for optimal task execution.

## Modes

```bash
/dirigent Add OAuth2 login                              # Interactive
/dirigent Add OAuth2 login --force                      # Skip plan options
/dirigent Add OAuth2 login --auto                       # No stops unless failure
/dirigent Add OAuth2 login --auto --force               # Zero interaction
/dirigent Fix login crash --phase=implement             # Jump to phase
/dirigent Ship auth --deploy=vercel                     # Ship + deploy
/dirigent Add checkout --with-e2e --with-a11y           # Include E2E + accessibility
/dirigent Refactor auth --with-perf --with-contracts    # Include perf + API contracts
/dirigent --resume                                      # Resume from last failure
/dirigent --budget=low Fix typo                         # Cost-efficient
```

| Flag | Behavior |
|------|----------|
| `--auto` | No stops unless failure |
| `--force` | Best plan, no options |
| `--phase=X` | Jump to phase |
| `--workflow=X` | Override workflow detection (feature/bugfix/hotfix/refactor/security-fix) |
| `--deploy=X` | Deploy: vercel/netlify/aws/gcp/digitalocean/docker/k8s |
| `--with-e2e` | Playwright E2E tests |
| `--with-integration` | Integration tests |
| `--with-visual` | Visual regression (Playwright screenshots) |
| `--with-a11y` | Accessibility audit (axe-core + WCAG 2.1 AA) |
| `--with-perf` | Bundle analysis + Lighthouse CI |
| `--with-contracts` | OpenAPI validation + contract tests |
| `--budget=X` | low/medium/high — controls model selection |
| `--resume` | Resume from last pipeline failure |

## Integrity Rules — NON-NEGOTIABLE

Enforced by PreToolUse hooks + reviewer agent. Violations block the pipeline.

- **NO** fake implementations (`console.log("TODO")`, empty bodies, stub returns)
- **NO** tautological logic (`true === true`, `1 === 1`)
- **NO** `any` types, `@ts-ignore`, swallowed errors (`catch(e) {}`)
- **NO** skipping failed tests (`it.skip`, changing expected values, weakening assertions)
- **NO** hallucinated APIs (verify before using: `grep`, `ls`, `pnpm ls`)
- **NO** `todo!()`/`unimplemented!()` in Rust production code

## State & Resume

Pipeline state persisted in `.dirigent/state.json`. If a phase fails, resume with:
```bash
/dirigent --resume
```

## Configuration

Customize via `.dirigent.json` in project root:
- Default mode, budget, deploy target
- Coverage thresholds
- Phase requirements (skip/require)
- Testing options (e2e, a11y, perf, contracts)
- Monorepo settings

## Project

- **Package manager**: pnpm
- **Node**: v22+

## Commands

```bash
pnpm dev               # Dev server
pnpm build             # Production build
pnpm typecheck         # tsc --noEmit
pnpm lint              # eslint --max-warnings=0
pnpm test              # vitest run
pnpm test:coverage     # vitest --coverage
pnpm test:e2e          # playwright test
pnpm security:scan     # Full security scan
```

## Structure

```
src/
├── app/          # Pages/routes
├── components/   # UI components
├── lib/          # Business logic
├── hooks/        # Custom hooks
├── types/        # Shared types
├── utils/        # Pure utilities
scripts/
├── security-scan.sh      # Gitleaks + audit + patterns
├── check-gitleaks.sh     # Install checker
├── dirigent-state.sh     # Pipeline state management
├── dirigent-memory.sh    # SQLite RAG memory CLI
├── dirigent-memory.ts    # Full TypeScript memory (optional vector support)
.dirigent/
├── state.json            # Pipeline state (gitignored)
├── memory.db             # SQLite RAG knowledge base (committed)
├── memory.md             # Human-readable notes (committed)
├── changes.log           # Audit trail (gitignored)
.github/
├── workflows/
│   └── ci.yml            # CI pipeline (lint, test, security, e2e)
docs/
├── features/     # Per-feature docs
├── adr/          # Architecture decisions
```

## Memory System (Enhanced SQLite RAG)

Persistent project knowledge with agent communication tracking via SQLite FTS5.

```bash
bash scripts/dirigent-memory.sh store pattern "Auth uses middleware chain in src/middleware/"
bash scripts/dirigent-memory.sh store decision "Chose Supabase RLS" --feature=auth
bash scripts/dirigent-memory.sh search "authentication"
bash scripts/dirigent-memory.sh context "Add OAuth2 login"   # Agents call at phase start
bash scripts/dirigent-memory.sh stats

# New: Agent communication tracking
bash scripts/dirigent-workflow.sh record-communication "designer" "architect" "VALIDATE: Component design" "design"
bash scripts/dirigent-memory.sh search "agent_communication" --limit=10
```

Types: pattern, convention, decision, tech_debt, dependency, api_contract, error_pattern, performance, security, test_pattern, deployment, migration, review_finding, workaround, agent_communication, validation_request, consensus

## Code Standards

- Strict TypeScript — no `any`, no `@ts-ignore`
- Named exports, colocated tests, conventional commits
- Max 400 lines/file, functional components, hooks only

## Quality Gates (Husky)

- **Pre-commit**: lint-staged → typecheck → tests (changed) → security (staged)
- **Commit-msg**: conventional commits (commitlint)
- **Pre-push**: typecheck → lint → all tests → build → full security scan

## Hooks (Claude Code)

- **PreToolUse**: validates Write/Edit for integrity violations — **blocks** (exit 2) on 🔴 violations, warns on 🟠
- **PostToolUse**: logs all file changes to `.dirigent/changes.log`
- **SubagentStop/Stop**: prints next phase suggestion for pipeline continuity

> **Note**: `jq` is required for the PreToolUse hook to function. Without it, integrity checks are skipped with a warning.

## Subagents (Enhanced with Collaboration)

| Agent | Model | Role |
|-------|-------|------|
| `architect` | opus | Technical design, validates designer's work, ADRs, memory |
| `designer` | sonnet | Frontend UI/UX & technical design, communicates with architect |
| `coordinator` | opus | Orchestrates agent collaboration, resolves conflicts |
| `implementer` | sonnet | Production code, requests feedback from designer/architect |
| `tester` | sonnet | Unit, integration, E2E, visual |
| `reviewer` | opus | Review against design specs, validates with architect/designer |
| `documenter` | sonnet | Docs, auto-changelog |
| `guardian` | haiku | Quality gates + security (parallel) |
| `pr-reviewer` | opus | CI-based PR review |

### Specialists

| Specialist | Expertise |
|-----------|-----------|
| `specialist-nextjs` | Next.js App Router, RSC, SSR, middleware |
| `specialist-react` | React 19+, hooks, Suspense, Server Components |
| `specialist-typescript` | Advanced types, generics, type guards |
| `specialist-nestjs` | NestJS modules, guards, pipes, microservices |
| `specialist-spring-boot` | Spring Boot 3+, JPA, Security, WebFlux |
| `specialist-rust` | Ownership, async Tokio, Axum, Serde, clippy |
| `specialist-python` | Python 3.12+, FastAPI, SQLAlchemy, pytest |
| `specialist-ios` | Swift 6+, SwiftUI, UIKit, Combine |
| `specialist-react-native` | React Native, Expo, New Architecture, navigation, animations |
| `specialist-shadcn` | shadcn/ui, Radix primitives, Tailwind |
| `specialist-playwright` | E2E tests, selectors, fixtures, CI |
| `specialist-figma` | Design-to-code, tokens, component mapping |
| `specialist-creative` | SVG, animations, GIFs, hero videos, motion |

### Skills

| Skill | Domain |
|-------|--------|
| `supabase` | Auth, DB, RLS, Storage, Edge Functions |
| `postgresql` | Schema, queries, indexing, performance |
| `kubernetes` | Deployments, services, ingress, HPA |
| `deploy-vercel` | Vercel setup, env vars, edge/serverless |
| `deploy-netlify` | Functions, edge, redirects |
| `deploy-aws` | ECS, Lambda, Amplify, CDK, SST |
| `deploy-gcp` | Cloud Run, GKE, Firebase |
| `deploy-digitalocean` | App Platform, Droplets, DOKS |
| `github-workflows` | CI/CD, branch protection, releases |
| `docker-localhost` | Dockerfile, compose, multi-stage, dev |
| `security-scan` | Gitleaks, audit, code patterns |
| `performance` | Bundle analysis, Lighthouse CI, Core Web Vitals |
| `accessibility` | axe-core, pa11y, WCAG 2.1 AA |
| `api-contracts` | OpenAPI, Redocly, contract testing |
| `memory-rag` | SQLite RAG, FTS5 search, agent knowledge persistence |

## Workflow System (v2)

Dirigent now features intelligent workflow detection and multi-agent collaboration:

### Automatic Workflow Detection
Based on task description, Dirigent selects optimal workflow:
- **feature**: Full lifecycle with dedicated design phase (designer + architect)
- **bugfix**: Root cause analysis → targeted fix
- **hotfix**: Emergency streamlined process
- **refactor**: Code improvement with preservation validation
- **security-fix**: Enhanced security checks and audit

### Multi-Agent Communication
Agents collaborate throughout the pipeline:
- Designer ↔ Architect: Design validation loops
- Implementer → Designer/Architect: Clarification and guidance
- Reviewer → All: Final validation against specs
- Coordinator: Orchestrates all communications

### Enhanced Features
- Workflow-specific phase configurations
- Inter-agent validation checkpoints
- Communication history in memory system
- Decision tracking and consensus building
- Automatic rollback on critical failures

See `docs/WORKFLOWS.md` for complete workflow documentation.
