# Project Context

## Purpose
AS400 Transaction Automation Test Platform is a lightweight, backend-first MVP for testing AS400 / IBM i transaction flows through REST, TCP/IP, IBM MQ, database checks, and multi-step scenarios.

OpenSpec is used in this repository as the change-entry layer: active changes under `openspec/changes/<change-id>/` define scope, rationale, acceptance, and spec deltas before implementation. Durable user-facing documentation remains in `README.md` and `docs/USER_GUIDE.md`; do not duplicate the same requirement in both places.

## Tech Stack
- Python 3.11+
- FastAPI
- Pydantic v2
- Uvicorn
- SQLite persistence
- Optional IBM MQ integration through `pymqi`
- Static HTML/CSS/JavaScript web UI under `as400_test_platform/static/`
- Pytest

## Project Conventions

### Code Style
- Keep the project lightweight and API-first.
- Prefer clear, direct Python over unnecessary abstraction.
- Keep API field names and UI-facing language in English.
- Preserve existing module boundaries unless a change explicitly requires reshaping them.

### Architecture Patterns
- `as400_test_platform/main.py` owns FastAPI routes and application wiring.
- `as400_test_platform/models.py` owns API schemas.
- `as400_test_platform/store.py` owns SQLite persistence.
- `as400_test_platform/executors.py` owns REST, TCP, MQ, DB, and scenario execution behavior.
- `as400_test_platform/static/` owns the tester/admin web interface.
- `docs/USER_GUIDE.md` is user-facing operational documentation, not a parallel implementation spec.

### Testing Strategy
- Use pytest for engine and API behavior.
- Add or update focused tests when changing execution logic, persistence behavior, validation semantics, or public API contracts.
- For UI-only changes, verify the static UI manually or with a local browser where practical.

### Git Workflow
- Keep changes small and reviewable.
- Do not rewrite unrelated local changes.
- Use OpenSpec proposals for meaningful feature, architecture, workflow, or behavior changes before implementation.

## Domain Context
- The platform targets AS400 / IBM i transaction testing.
- Supported protocols include REST, TCP, MQ, and DB checks.
- Test collections group test cases and multi-step scenarios.
- Environments hold host, port, credential, rollback, and reusable variable data.
- Daily testers should work mostly through run/report/library flows; protocol and backend configuration belongs in admin-oriented flows.

## Important Constraints
- Keep the MVP lightweight; avoid heavy process or directory churn for small changes.
- OpenSpec is the source of truth for active change scope and acceptance while a change is open.
- `README.md` and `docs/USER_GUIDE.md` are updated only when durable user-facing behavior changes.
- Avoid maintaining competing requirements or design decisions in OpenSpec and docs at the same time.

## External Dependencies
- AS400 / IBM i TCP endpoints
- REST APIs under test
- IBM MQ queue managers and queues
- Backend databases used for validation checks
