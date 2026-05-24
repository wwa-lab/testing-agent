from __future__ import annotations

import json
from typing import Any

from .models import (
    Collection,
    CollectionCreate,
    DbRequest,
    MqRequest,
    Protocol,
    RestRequest,
    TcpRequest,
    TestCaseCreate,
    TransactionRequest,
    ValidationOperator,
    ValidationRule,
)

POSTMAN_SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
META_PREFIX = "AS400_TEST_PLATFORM_META:"


def is_postman_collection(payload: dict[str, Any]) -> bool:
    return isinstance(payload.get("info"), dict) and isinstance(payload.get("item"), list)


def from_postman_collection(payload: dict[str, Any]) -> CollectionCreate:
    info = payload.get("info", {})
    cases: list[TestCaseCreate] = []
    for item in _flatten_items(payload.get("item", [])):
        if "request" not in item:
            continue
        cases.append(_case_from_postman_item(item))
    return CollectionCreate(
        name=info.get("name") or "Imported Postman Collection",
        description=_description_to_text(info.get("description")),
        test_cases=cases,
        scenarios=[],
    )


def to_postman_collection(collection: Collection) -> dict[str, Any]:
    return {
        "info": {
            "name": collection.name,
            "description": collection.description or "",
            "schema": POSTMAN_SCHEMA,
        },
        "item": [_case_to_postman_item(item) for item in collection.test_cases],
        "variable": [
            {"key": "platform_base_url", "value": "http://127.0.0.1:8001"},
            {"key": "as400_host", "value": "mock-as400.local"},
            {"key": "mq_host", "value": "mock-mq.local"},
        ],
    }


def _flatten_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    flattened: list[dict[str, Any]] = []
    for item in items:
        children = item.get("item")
        if isinstance(children, list):
            flattened.extend(_flatten_items(children))
        else:
            flattened.append(item)
    return flattened


def _case_from_postman_item(item: dict[str, Any]) -> TestCaseCreate:
    meta = _read_meta(item)
    if meta:
        return TestCaseCreate.model_validate(meta)
    request = item.get("request", {})
    url = _url_to_raw(request.get("url"))
    headers = _headers_to_dict(request.get("header", []))
    body = _body_from_postman(request.get("body"))
    validations = _validations_from_events(item.get("event", []))
    return TestCaseCreate(
        name=item.get("name") or "Imported API",
        description=_description_to_text(request.get("description") or item.get("description")),
        tags=[],
        request=TransactionRequest(
            protocol=Protocol.REST,
            rest=RestRequest(
                method=request.get("method", "GET"),
                url=url,
                headers=headers,
                body=body,
            ),
        ),
        validations=validations,
    )


def _case_to_postman_item(test_case: Any) -> dict[str, Any]:
    protocol = test_case.request.protocol
    if protocol == Protocol.REST and test_case.request.rest:
        request = _rest_to_postman_request(test_case.request.rest)
    elif protocol == Protocol.TCP and test_case.request.tcp:
        request = _tcp_to_postman_request(test_case.request.tcp)
    elif protocol == Protocol.MQ and test_case.request.mq:
        request = _mq_to_postman_request(test_case.request.mq)
    elif protocol == Protocol.DB and test_case.request.db:
        request = _db_to_postman_request(test_case.request.db)
    else:
        request = {"method": "GET", "url": {"raw": "about:blank"}, "description": ""}
    request["description"] = _with_meta(request.get("description", ""), test_case.model_dump())
    return {
        "name": test_case.name,
        "request": request,
        "event": [_validations_to_test_event(test_case.validations)],
    }


def _rest_to_postman_request(request: RestRequest) -> dict[str, Any]:
    return {
        "method": request.method,
        "header": [{"key": key, "value": value} for key, value in request.headers.items()],
        "url": {"raw": request.url},
        "body": _body_to_postman(request.body),
    }


def _tcp_to_postman_request(request: TcpRequest) -> dict[str, Any]:
    return {
        "method": "POST",
        "header": [{"key": "X-Test-Protocol", "value": "TCP"}],
        "url": {"raw": f"tcp://{request.host}:{request.port}"},
        "body": {"mode": "raw", "raw": request.payload},
        "description": "TCP/IP transaction metadata is preserved for AS400 Test Studio.",
    }


def _mq_to_postman_request(request: MqRequest) -> dict[str, Any]:
    return {
        "method": "POST",
        "header": [{"key": "X-Test-Protocol", "value": "MQ"}],
        "url": {"raw": f"mq://{request.queue_manager}/{request.request_queue}"},
        "body": {"mode": "raw", "raw": request.payload},
        "description": "IBM MQ transaction metadata is preserved for AS400 Test Studio.",
    }


def _db_to_postman_request(request: DbRequest) -> dict[str, Any]:
    return {
        "method": "POST",
        "header": [{"key": "X-Test-Protocol", "value": "DB"}],
        "url": {"raw": f"db://{request.driver}"},
        "body": {"mode": "raw", "raw": request.query},
        "description": "Backend DB validation metadata is preserved for AS400 Test Studio.",
    }


def _body_to_postman(body: Any) -> dict[str, Any] | None:
    if body is None:
        return None
    raw = json.dumps(body) if isinstance(body, (dict, list)) else str(body)
    return {"mode": "raw", "raw": raw}


def _body_from_postman(body: dict[str, Any] | None) -> Any:
    if not body:
        return None
    raw = body.get("raw")
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def _headers_to_dict(headers: list[dict[str, Any]]) -> dict[str, str]:
    result: dict[str, str] = {}
    for item in headers or []:
        key = item.get("key")
        value = item.get("value")
        if key is not None and value is not None:
            result[str(key)] = str(value)
    return result


def _url_to_raw(url: Any) -> str:
    if isinstance(url, str):
        return url
    if isinstance(url, dict):
        return url.get("raw") or ""
    return ""


def _validations_to_test_event(validations: list[ValidationRule]) -> dict[str, Any]:
    lines = []
    for rule in validations:
        if rule.source == "status_code" and rule.operator == ValidationOperator.EQUALS:
            lines.append(f'pm.test("{rule.name}", function () {{ pm.response.to.have.status({json.dumps(rule.expected)}); }});')
        elif rule.source == "text" and rule.operator == ValidationOperator.CONTAINS:
            lines.append(
                f'pm.test("{rule.name}", function () {{ pm.expect(pm.response.text()).to.include({json.dumps(rule.expected)}); }});'
            )
        else:
            lines.append(f'pm.test("{rule.name}", function () {{ pm.expect(true).to.eql(true); }});')
    return {"listen": "test", "script": {"type": "text/javascript", "exec": lines}}


def _validations_from_events(events: list[dict[str, Any]]) -> list[ValidationRule]:
    validations: list[ValidationRule] = []
    for event in events or []:
        if event.get("listen") != "test":
            continue
        lines = event.get("script", {}).get("exec", [])
        for line in lines:
            if "pm.response.to.have.status" in line:
                name = _extract_test_name(line)
                expected = _extract_first_int(line)
                validations.append(
                    ValidationRule(name=name, source="status_code", operator=ValidationOperator.EQUALS, expected=expected)
                )
            elif ".to.include" in line and "pm.response.text()" in line:
                name = _extract_test_name(line)
                expected = _extract_first_string_arg(line.split(".to.include", 1)[1])
                validations.append(
                    ValidationRule(name=name, source="text", operator=ValidationOperator.CONTAINS, expected=expected)
                )
    return validations


def _extract_test_name(line: str) -> str:
    marker = 'pm.test("'
    if marker not in line:
        return "Imported validation"
    return line.split(marker, 1)[1].split('"', 1)[0]


def _extract_first_int(line: str) -> int:
    digits = "".join(char if char.isdigit() else " " for char in line).split()
    return int(digits[-1]) if digits else 200


def _extract_first_string_arg(text: str) -> str:
    if '"' not in text:
        return ""
    return text.split('"', 2)[1]


def _with_meta(description: Any, payload: dict[str, Any]) -> str:
    base = _description_to_text(description) or ""
    meta = f"{META_PREFIX}{json.dumps(payload, separators=(',', ':'))}"
    return f"{base}\n\n{meta}".strip()


def _read_meta(item: dict[str, Any]) -> dict[str, Any] | None:
    request = item.get("request", {})
    for source in [item.get("description"), request.get("description")]:
        text = _description_to_text(source) or ""
        if META_PREFIX in text:
            raw = text.split(META_PREFIX, 1)[1].strip()
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return None
    return None


def _description_to_text(description: Any) -> str | None:
    if description is None:
        return None
    if isinstance(description, str):
        return description
    if isinstance(description, dict):
        return description.get("content") or description.get("raw") or ""
    return str(description)
