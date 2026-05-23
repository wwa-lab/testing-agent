# User Guide

## 1. Purpose

AS400 Transaction Automation Test Platform is an API-first automation platform for validating AS400 / IBM i transactions.

It supports:

- TCP/IP authorization transactions
- RESTful API transactions
- IBM MQ transactions
- Backend database validation
- Single test execution
- Batch execution
- Multi-step scenario execution
- Report generation with pass/fail details and failure reasons

The UI-facing language and API field names are English.

## 2. Start the Platform

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn as400_test_platform.main:app --reload --port 8000
```

Then open:

- Swagger UI: `http://127.0.0.1:8000/docs`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

## 3. Core Concepts

### Environment

An environment stores host names, ports, credentials, and reusable variables.

Example variables:

```json
{
  "rest_base_url": "https://sit-api.company.com",
  "as400_host": "10.10.20.30",
  "as400_auth_port": "9001",
  "mq_host": "10.10.20.40"
}
```

Use variables inside scripts with `{{variable_name}}`.

### Test Case

A test case contains:

- Protocol: `REST`, `TCP`, `MQ`, or `DB`
- Request definition
- Validation rules

### Scenario

A scenario is a business flow with multiple test steps.

Example:

1. Send REST request to create a customer
2. Send TCP authorization transaction
3. Send or validate MQ event
4. Query backend DB
5. Generate report

### Collection

A collection groups test cases and scenarios for batch loading and batch execution.

## 4. Create an Environment

Endpoint:

```text
POST /environments
```

Example:

```json
{
  "name": "AS400 Static SIT",
  "description": "Rollback-ready AS400 test environment",
  "variables": {
    "rest_base_url": "https://sit-api.company.com",
    "as400_host": "10.10.20.30",
    "as400_auth_port": "9001"
  },
  "rollback": {
    "mode": "manual",
    "snapshot": "SIT_BASELINE_2026_05"
  }
}
```

## 5. Create a REST Test Case

Endpoint:

```text
POST /test-cases
```

Example:

```json
{
  "name": "REST - Query Authorization",
  "tags": ["authorization", "rest"],
  "request": {
    "protocol": "REST",
    "rest": {
      "method": "GET",
      "url": "{{rest_base_url}}/authorizations/A10001",
      "headers": {
        "Accept": "application/json"
      },
      "timeout_seconds": 30
    }
  },
  "validations": [
    {
      "name": "HTTP status is 200",
      "source": "status_code",
      "operator": "equals",
      "expected": 200
    },
    {
      "name": "Result code is approved",
      "source": "json",
      "path": "$.resultCode",
      "operator": "equals",
      "expected": "00"
    }
  ]
}
```

## 6. Create a TCP/IP Authorization Test Case

```json
{
  "name": "TCP - Authorization Approved",
  "tags": ["authorization", "tcp"],
  "request": {
    "protocol": "TCP",
    "tcp": {
      "host": "{{as400_host}}",
      "port": 9001,
      "encoding": "ebcdic",
      "response_encoding": "ebcdic",
      "payload": "AUTH000000010000000100",
      "timeout_seconds": 30,
      "read_bytes": 4096
    }
  },
  "validations": [
    {
      "name": "Response contains approval code",
      "source": "text",
      "operator": "contains",
      "expected": "APPROVED"
    }
  ]
}
```

## 7. Create an MQ Test Case

The MVP supports MQ simulation by default. For real IBM MQ execution, install the optional `pymqi` dependency and set `simulate` to `false`.

```json
{
  "name": "MQ - Settlement Event",
  "tags": ["mq", "settlement"],
  "request": {
    "protocol": "MQ",
    "mq": {
      "queue_manager": "QM1",
      "channel": "DEV.APP.SVRCONN",
      "host": "{{mq_host}}",
      "port": 1414,
      "request_queue": "DEV.REQUEST",
      "response_queue": "DEV.RESPONSE",
      "payload": "{\"transactionId\":\"T10001\",\"amount\":100}",
      "correlation_id": "T10001",
      "simulate": true
    }
  },
  "validations": [
    {
      "name": "Correlation ID exists",
      "source": "mqmd",
      "path": "correlation_id",
      "operator": "exists"
    }
  ]
}
```

## 8. Backend DB Validation

The MVP includes SQLite DB validation. Enterprise DB2/AS400 database drivers can be added behind the same `DB` request shape.

```json
{
  "name": "DB - Validate Authorization Record",
  "request": {
    "protocol": "DB",
    "db": {
      "driver": "sqlite",
      "connection": "data/backend_validation.sqlite3",
      "query": "select status from authorization_result where transaction_id = ?",
      "parameters": ["T10001"]
    }
  },
  "validations": [
    {
      "name": "One backend row exists",
      "source": "db",
      "path": "row_count",
      "operator": "equals",
      "expected": 1
    },
    {
      "name": "Backend status is POSTED",
      "source": "db",
      "path": "rows.0.status",
      "operator": "equals",
      "expected": "POSTED"
    }
  ]
}
```

## 9. Run a Single Test Case

```text
POST /runs/test-cases/{case_id}
```

Body:

```json
{
  "environment_id": "environment-id"
}
```

## 10. Run a Batch

```text
POST /runs/batch
```

Body:

```json
{
  "environment_id": "environment-id",
  "test_case_ids": ["case-1", "case-2"],
  "scenario_ids": ["scenario-1"],
  "stop_on_failure": false
}
```

## 11. Load a Collection

```text
POST /collections
```

You can upload a full set of test cases and scenarios in one request. See `examples/sample_collection.json`.

## 12. Read Reports

List reports:

```text
GET /reports
```

Get one report:

```text
GET /reports/{report_id}
```

Each report includes:

- Overall status: `PASSED`, `FAILED`, or `PARTIAL`
- Total / passed / failed count
- Protocol summary
- Case-level result
- Step-level validation result
- Failure reason
- Raw response snapshot
- Execution timing

## 13. Recommended Integration Flow

1. Create one environment per AS400 test environment.
2. Load generated or manually prepared collections through `POST /collections`.
3. Trigger single tests during debugging with `POST /runs/test-cases/{case_id}`.
4. Trigger regression batches with `POST /runs/batch`.
5. Pull reports with `GET /reports/{report_id}`.
6. Integrate the batch run endpoint into Jenkins, GitLab CI, or another scheduler.

## 14. Next Production Hardening Items

Recommended next steps before enterprise deployment:

- Add authentication and role-based access control.
- Add encrypted secret storage for passwords and tokens.
- Add DB2 for i / IBM i backend validation driver.
- Add real MQ get-response and correlation matching.
- Add rollback trigger integration for the static AS400 test environment.
- Add a web UI using the same API, with Postman-like hierarchy display.
- Add Git-backed version control for scripts.

