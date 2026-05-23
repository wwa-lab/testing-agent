# AS400 Transaction Automation Test Platform

This repository contains a lightweight API-first MVP for testing AS400 / IBM i transactions across:

- TCP/IP authorization transactions
- RESTful API transactions
- IBM MQ transactions
- Multi-step scenarios with response validation and backend database checks
- Execution reports for single and batch runs

The platform is intentionally backend-first so other systems can integrate with it through REST APIs.

## Quick Start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn as400_test_platform.main:app --reload --port 8000
```

Open API documentation:

- Swagger UI: http://127.0.0.1:8000/docs
- OpenAPI JSON: http://127.0.0.1:8000/openapi.json

## Important Files

- `as400_test_platform/main.py` - FastAPI application and public API routes
- `as400_test_platform/models.py` - API schemas
- `as400_test_platform/store.py` - SQLite persistence
- `as400_test_platform/executors.py` - REST, TCP, MQ, DB, and scenario execution
- `docs/USER_GUIDE.md` - English user guide
- `examples/sample_collection.json` - Example collection with REST, TCP, MQ, and DB steps

