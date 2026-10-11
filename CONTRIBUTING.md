# Contributing to qeek

Thank you for your interest in contributing to qeek! This document provides guidelines for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- Node.js 22+ (pnpm 11 needs `node:sqlite`, unavailable on Node 20)
- Python 3.11+
- pnpm 11.7.0 (`npm install -g pnpm@11.7.0`; matches `packageManager` and upstream)
- Git

### Development Setup

```bash
# Fork and clone
git clone https://github.com/blessandy9104-hue/qeek.git
cd qeek

# Install mathcore (sibling checkout; provides the mathcore-mcp server binary)
pip install -e ../mathcore

# Install dependencies
pnpm install

# Build
pnpm run build

# Run checks (all must pass)
pnpm run lint
pnpm run typecheck
pnpm test

# Start the CLI assistant
pnpm start
```

## Development Workflow

### Branch Naming

- `feature/<description>` - New features
- `fix/<description>` - Bug fixes
- `docs/<description>` - Documentation updates
- `refactor/<description>` - Code refactoring
- `test/<description>` - Test additions
- `chore/<description>` - Maintenance tasks

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Refactoring
- `test` - Tests
- `chore` - Maintenance
- `ci` - CI/CD changes

Examples:
```
feat(capability): add capability adaptation for research tasks
fix(math): handle mathcore MCP connection timeout
docs(api): update capability API reference
```

### Pull Requests

1. Create a feature branch from `main`
2. Make your changes with tests
3. Run `pnpm run lint && pnpm run test`
4. Push and create PR
5. Ensure CI passes
6. Request review

### Testing Requirements

- Unit tests for new functions/classes
- Integration tests for new features
- E2E tests for user-facing changes
- Maintain 80% code coverage

## Project Structure

```
qeek/
├── apps/                    # Applications (CLI, Web, Desktop)
├── packages/                # 43+ plugins
│   ├── qeek-*              # Core plugins
│   └── qeek-capability     # Capability awareness
├── tests/                   # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── config/                  # Cordis profiles
├── docker/                  # Dockerfiles
├── docs/                    # Documentation
└── scripts/                 # Utility scripts
```

## Adding a New Plugin

1. Create directory in `packages/qeek-<name>/`
2. Add `package.json` with workspace dependencies
3. Implement `src/index.ts` with `definePlugin`
4. Add tests in `tests/unit/`
5. Register in `config/personal-assistant.cordis.yml`
6. Update documentation

## Style Guide

- TypeScript strict mode
- ESLint + oxlint
- Prettier formatting
- JSDoc for public APIs
- No `any` types without justification

## Reporting Issues

Use GitHub Issues with:
- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Logs/screenshots if applicable

## Security Issues

Report security vulnerabilities to **blessandy9104@gmail.com** (not public issues).

## Questions?

- GitHub Discussions for general questions
- Discord: [qeek community](https://discord.gg/qeek)
- Email: blessandy9104@gmail.com