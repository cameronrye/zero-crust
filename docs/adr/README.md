# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Zero Crust POS system.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences. ADRs help future developers understand why certain decisions were made.

## ADR Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](001-ipc-command-pattern.md) | IPC Command Pattern with Zod Validation | Accepted |
| [ADR-002](002-integer-currency.md) | Integer-Only Currency (Cents) | Accepted |
| [ADR-003](003-centralized-state-management.md) | Centralized State Management with MainStore | Accepted |
| [ADR-004](004-electron-security.md) | Electron Security Configuration | Accepted |
| [ADR-005](005-full-state-broadcast.md) | Full State Broadcast Pattern | Accepted |
| [ADR-006](006-architecture-debug-window.md) | Architecture Debug Window | Accepted |

## ADR Template

When creating a new ADR, use the following template:

```markdown
# ADR-XXX: Title

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult to do because of this change?
```

## References

- [ADR GitHub Organization](https://adr.github.io/)
- [Michael Nygard's ADR Article](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)

