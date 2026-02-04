# Changelog

All notable changes to the OMS NestJS backend will be documented in this file.

## [Unreleased]

### Bug Fixes

- **ci:** Add individual DATABASE_* env vars to e2e test step to fix PostgreSQL auth error

## [0.5.0] - 2026-02-04

### Infrastructure

- Wire up Bitnami Sealed Secrets for staging-v2 deployment (`d7b029c`)
- Use Dockerfile.production for staging deployment build (`824b85b`)
- Update CI/CD pipeline, Dockerfile, Jenkinsfile, and infrastructure configs (`7a517ed`)
- Fix working dirs, Docker image names, and markdownlint config (`c008147`)

### Bug Fixes

- Fix staging V2 deployment: health probes, DB config, auth secrets (`d6083c4`)
- Fix PR checks: versioned API URLs, missing PORT, and health check endpoints (`2ffe8b9`)
- Fix e2e test: use env-cmd --silent instead of --fallback (`fa8a47d`)
- Fix CI health check URL: use /api/health instead of /health (`ada9004`)
- Skip cache warming in test environment and add env-cmd fallback for e2e tests (`3df9b6e`)
- Fix lint: add await to async loadPopularProducts to satisfy require-await rule (`9a8bd4a`)
- Remove unnecessary async from loadPopularProducts method (`31af3da`)
- Fix CI failures: Redis health check default host and cache warming error counting (`14cc1a9`)
- Fix ajv dependency conflict and infer database type from URL (`2fab58d`)
- Fix missing uuid type declarations for domain value objects (`fb48be8`)
- Fix Reports test: add URL.createObjectURL mock for jsdom (`6cfb1f1`)

### Security

- Fix backend vulnerabilities: update release-it and @aws-sdk/client-s3 (`4fc7266`)
- Fix gitleaks false positive for Jenkins credential bindings (`504295d`)
- Fix security vulnerabilities: patch jspdf, replace xlsx with exceljs (`7d8d6c9`)

## [0.4.0] - 2026-02-03

### Infrastructure

- Fix CI/CD pipeline: Node 20, CodeQL v3, remove Ralph Loop, fix PR checks (`04451fc`)
- Fix CodeQL v2 deprecation and npm cache-dependency-path in CI pipeline (`a142aa4`)
- Switch all workflow jobs from ARC self-hosted runners to GitHub-hosted ubuntu-latest (`80146d4`)
- Switch eligible workflow jobs to ARC self-hosted runners (`674e2c7`)

### Bug Fixes

- Fix YAML indentation in ci-cd.yml trigger-jenkins-deploy job (`2b356f3`)
- Fix CI runners, Docker tag prefix, and logo test assertion (`2ef3e5a`)
- Fix NODE_ENV in staging Helm values to valid NestJS enum (`598a874`)
- Fix health check paths and registry secret name in Jenkinsfiles (`591a0d6`)

### Frontend

- Update frontend components and apply code formatting fixes (`5743602`)

## [0.3.0] - 2026-02-02

### Features

- Migrate from Bull to BullMQ for cache invalidation queue (`93f6c0f`)
- Add CodeQL workflow, update packages, remove yarn.lock (`2db4584`)

### Bug Fixes

- Fix GitHub Actions branch-to-environment mapping (`1c0367f`)
- Fix repairs page to use enriched_orders endpoint with repair filter (`205aa6e`)
- Fix kubectl version prefix and add BullMQ Redis root config (`083537e`)
- Restore async useFactory with eslint-disable for require-await (`e936071`)
- Fix formatting in cache module and production cache service (`1c555af`)
- Fix 153 failing frontend tests and update rolePermissions source (`8286a12`)
- Add eslint-disable comments for no-explicit-any lint errors (`ebce04b`)
- Change CodeQL runner back to ubuntu-latest (`8bdac33`)
- Change CodeQL runner to self-hosted (`51384cd`)

### Dependencies

- Update @nestjs/axios to v4.0.1 (`4005397`)

## [0.2.0] - 2026-02-01

### Features

- Add saddle extras module, model management modals, audit logging, and comprehensive frontend updates (`1c06f79`)
- Add staging branch support to CI/CD pipeline and comprehensive OMS updates (`86d6d47`)
- Add type-check script to frontend and fix test type mismatches (`7aec125`)

### Infrastructure

- Update Jenkinsfile and add Jenkins Helm config for CICD pipeline (`b680e7a`)
- Secure environment variables across Kubernetes, Jenkins, and GitHub Actions (`354c533`)

### Bug Fixes

- Fix all frontend TypeScript type-check errors (tsc --noEmit) (`a66fad6`)
- Apply code formatting, remove unused imports, and add ESLint annotations (`a0cae99`)

## [0.1.0] - 2026-01-29

### Features

- Update OMS backend, frontend, and e2e with new modules, migrations, and improvements (`efcc622`)

## [0.0.1] - 2026-01-20

- Initial commit: OMS NestJS/Next.js project setup (`e704183`)
