from __future__ import annotations

import json
import re
import socket
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from typing import Any

from .models import (
    CaseResult,
    DbRequest,
    Environment,
    MqRequest,
    Protocol,
    RestRequest,
    RunReport,
    Scenario,
    ScenarioResult,
    TcpRequest,
    TestCase,
    TransactionResponse,
    ValidationOperator,
    ValidationResult,
)
from .store import Store


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


class ExecutionError(ValueError):
    pass


class ExecutionEngine:
    def __init__(self, store: Store) -> None:
        self.store = store

    def run_case(self, case: TestCase, environment: Environment | None = None) -> CaseResult:
        response = self._execute(case, environment)
        validations = [validate(rule, response) for rule in case.validations]
        transport_ok = response.status == "OK"
        passed = transport_ok and all(item.passed for item in validations)
        if transport_ok and not validations:
            validations.append(ValidationResult(name="transport", passed=True, message="Transaction completed"))
        if not transport_ok and not validations:
            validations.append(ValidationResult(name="transport", passed=False, message=response.error))
        return CaseResult(
            case_id=case.id,
            case_name=case.name,
            protocol=case.request.protocol,
            passed=passed,
            response=response,
            validations=validations,
        )

    def run_scenario(self, scenario: Scenario, environment: Environment | None = None) -> ScenarioResult:
        results: list[CaseResult] = []
        passed = True
        for step in scenario.steps:
            if step.test_case_id:
                case = self.store.get_case(step.test_case_id)
                if not case:
                    response = TransactionResponse(
                        protocol=Protocol.REST,
                        status="ERROR",
                        response_time_ms=0,
                        error=f"Test case not found: {step.test_case_id}",
                    )
                    result = CaseResult(
                        case_id=step.test_case_id,
                        case_name=step.name,
                        protocol=Protocol.REST,
                        passed=False,
                        response=response,
                        validations=[],
                    )
                else:
                    result = self.run_case(case, environment)
            elif step.inline_case:
                case = TestCase(**step.inline_case.model_dump())
                result = self.run_case(case, environment)
            else:
                raise ExecutionError(f"Scenario step '{step.name}' has no test case")
            results.append(result)
            passed = passed and result.passed
            if not result.passed and not step.continue_on_failure:
                break
        return ScenarioResult(
            scenario_id=scenario.id,
            scenario_name=scenario.name,
            passed=passed,
            steps=results,
        )

    def build_report(
        self,
        environment_id: str | None,
        case_results: list[CaseResult],
        scenario_results: list[ScenarioResult],
        started_at: str,
    ) -> RunReport:
        finished_at = now_iso()
        scenario_steps = [step for scenario in scenario_results for step in scenario.steps]
        all_case_results = case_results + scenario_steps
        total = len(all_case_results)
        passed = sum(1 for item in all_case_results if item.passed)
        failed = total - passed
        if failed == 0:
            status = "PASSED"
        elif passed == 0:
            status = "FAILED"
        else:
            status = "PARTIAL"
        report = RunReport(
            status=status,
            environment_id=environment_id,
            summary={
                "total": total,
                "passed": passed,
                "failed": failed,
                "success_rate": round((passed / total) * 100, 2) if total else 0,
                "protocols": _protocol_summary(all_case_results),
            },
            case_results=case_results,
            scenario_results=scenario_results,
            started_at=started_at,
            finished_at=finished_at,
        )
        self.store.save("report", report)
        return report

    def _execute(self, case: TestCase, environment: Environment | None) -> TransactionResponse:
        protocol = case.request.protocol
        variables = environment.variables if environment else {}
        try:
            if protocol == Protocol.REST and case.request.rest:
                return execute_rest(render_rest(case.request.rest, variables))
            if protocol == Protocol.TCP and case.request.tcp:
                return execute_tcp(render_tcp(case.request.tcp, variables))
            if protocol == Protocol.MQ and case.request.mq:
                return execute_mq(render_mq(case.request.mq, variables))
            if protocol == Protocol.DB and case.request.db:
                return execute_db(render_db(case.request.db, variables))
        except Exception as exc:  # noqa: BLE001
            return TransactionResponse(
                protocol=protocol,
                status="ERROR",
                response_time_ms=0,
                error=str(exc),
            )
        return TransactionResponse(
            protocol=protocol,
            status="ERROR",
            response_time_ms=0,
            error=f"Missing request configuration for protocol {protocol.value}",
        )


def execute_rest(request: RestRequest) -> TransactionResponse:
    started = time.perf_counter()
    query = urllib.parse.urlencode(request.query, doseq=True)
    url = f"{request.url}?{query}" if query else request.url
    data = None
    headers = dict(request.headers)
    if request.body is not None:
        if isinstance(request.body, (dict, list)):
            data = json.dumps(request.body).encode("utf-8")
            headers.setdefault("Content-Type", "application/json")
        else:
            data = str(request.body).encode("utf-8")
    req = urllib.request.Request(url, method=request.method.upper(), data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=request.timeout_seconds) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            body = _try_json(raw)
            elapsed = (time.perf_counter() - started) * 1000
            return TransactionResponse(
                protocol=Protocol.REST,
                status="OK",
                status_code=resp.status,
                headers=dict(resp.headers.items()),
                body=body,
                raw_body=raw,
                response_time_ms=round(elapsed, 2),
            )
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        elapsed = (time.perf_counter() - started) * 1000
        return TransactionResponse(
            protocol=Protocol.REST,
            status="OK",
            status_code=exc.code,
            headers=dict(exc.headers.items()),
            body=_try_json(raw),
            raw_body=raw,
            response_time_ms=round(elapsed, 2),
        )


def execute_tcp(request: TcpRequest) -> TransactionResponse:
    started = time.perf_counter()
    if request.mock_response is not None:
        return TransactionResponse(
            protocol=Protocol.TCP,
            status="OK",
            body={"message": request.mock_response, "mocked": True},
            raw_body=request.mock_response,
            response_time_ms=request.mock_response_time_ms,
            metadata={
                "host": request.host,
                "port": request.port,
                "encoding": request.encoding,
                "bytes_received": len(request.mock_response.encode("utf-8")),
                "mocked": True,
            },
        )
    payload = request.payload + ("\n" if request.append_newline else "")
    outbound = encode_payload(payload, request.encoding)
    with socket.create_connection((request.host, request.port), timeout=request.timeout_seconds) as sock:
        sock.settimeout(request.timeout_seconds)
        sock.sendall(outbound)
        inbound = sock.recv(request.read_bytes)
    elapsed = (time.perf_counter() - started) * 1000
    raw = decode_payload(inbound, request.response_encoding)
    return TransactionResponse(
        protocol=Protocol.TCP,
        status="OK",
        body={"message": raw},
        raw_body=raw,
        response_time_ms=round(elapsed, 2),
        metadata={"bytes_received": len(inbound)},
    )


def execute_mq(request: MqRequest) -> TransactionResponse:
    started = time.perf_counter()
    if request.simulate:
        elapsed = (time.perf_counter() - started) * 1000
        return TransactionResponse(
            protocol=Protocol.MQ,
            status="OK",
            body={"message": request.payload, "simulated": True},
            raw_body=request.payload,
            response_time_ms=round(elapsed, 2),
            metadata={
                "queue_manager": request.queue_manager,
                "request_queue": request.request_queue,
                "response_queue": request.response_queue,
                "correlation_id": request.correlation_id,
            },
        )
    try:
        import pymqi  # type: ignore[import-not-found]
    except ImportError as exc:
        raise ExecutionError("Real MQ execution requires installing the optional 'pymqi' dependency") from exc

    cd = pymqi.CD()
    cd.ChannelName = request.channel or ""
    cd.ConnectionName = f"{request.host}({request.port})" if request.host and request.port else ""
    qmgr = pymqi.QueueManager(None)
    qmgr.connect_with_options(request.queue_manager, cd=cd)
    try:
        queue = pymqi.Queue(qmgr, request.request_queue)
        queue.put(request.payload.encode(request.encoding))
        queue.close()
    finally:
        qmgr.disconnect()
    elapsed = (time.perf_counter() - started) * 1000
    return TransactionResponse(
        protocol=Protocol.MQ,
        status="OK",
        body={"message": request.payload},
        raw_body=request.payload,
        response_time_ms=round(elapsed, 2),
        metadata={"queue_manager": request.queue_manager, "request_queue": request.request_queue},
    )


def execute_db(request: DbRequest) -> TransactionResponse:
    started = time.perf_counter()
    if request.mock_rows is not None:
        elapsed = (time.perf_counter() - started) * 1000
        return TransactionResponse(
            protocol=Protocol.DB,
            status="OK",
            body={"rows": request.mock_rows, "row_count": len(request.mock_rows), "mocked": True},
            raw_body=json.dumps(request.mock_rows),
            response_time_ms=round(elapsed, 2),
            metadata={"driver": request.driver, "mocked": True},
        )
    with sqlite3.connect(request.connection) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(request.query, request.parameters).fetchall()
    elapsed = (time.perf_counter() - started) * 1000
    payload = [dict(row) for row in rows]
    return TransactionResponse(
        protocol=Protocol.DB,
        status="OK",
        body={"rows": payload, "row_count": len(payload)},
        raw_body=json.dumps(payload),
        response_time_ms=round(elapsed, 2),
    )


def validate(rule: Any, response: TransactionResponse) -> ValidationResult:
    actual = extract_actual(rule.source, rule.path, response)
    passed = compare(actual, rule.operator, rule.expected)
    message = None if passed else f"{rule.source}:{rule.path or ''} {rule.operator.value} validation failed"
    return ValidationResult(
        name=rule.name,
        passed=passed,
        actual=actual,
        expected=rule.expected,
        message=message,
    )


def extract_actual(source: str, path: str | None, response: TransactionResponse) -> Any:
    if source == "status_code":
        return response.status_code
    if source == "response_time_ms":
        return response.response_time_ms
    if source == "text":
        return response.raw_body
    if source == "headers":
        return get_path(response.headers, path)
    if source in {"json", "body", "db"}:
        return get_path(response.body, path)
    if source == "mqmd":
        return get_path(response.metadata, path)
    return None


def compare(actual: Any, operator: ValidationOperator, expected: Any) -> bool:
    if operator == ValidationOperator.EXISTS:
        return actual is not None
    if operator == ValidationOperator.EQUALS:
        return actual == expected
    if operator == ValidationOperator.NOT_EQUALS:
        return actual != expected
    if operator == ValidationOperator.CONTAINS:
        return actual is not None and str(expected) in str(actual)
    if operator == ValidationOperator.REGEX:
        return actual is not None and expected is not None and re.search(str(expected), str(actual)) is not None
    if operator == ValidationOperator.LESS_THAN:
        return float(actual) < float(expected)
    if operator == ValidationOperator.GREATER_THAN:
        return float(actual) > float(expected)
    return False


def get_path(value: Any, path: str | None) -> Any:
    if path in {None, "", "$"}:
        return value
    current = value
    clean_path = path[2:] if path.startswith("$.") else path
    for part in clean_path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list) and part.isdigit():
            current = current[int(part)]
        else:
            return None
    return current


def encode_payload(payload: str, encoding: str) -> bytes:
    if encoding == "hex":
        return bytes.fromhex(payload)
    if encoding == "ebcdic":
        return payload.encode("cp037")
    return payload.encode(encoding)


def decode_payload(payload: bytes, encoding: str) -> str:
    if encoding == "hex":
        return payload.hex()
    if encoding == "ebcdic":
        return payload.decode("cp037", errors="replace")
    return payload.decode(encoding, errors="replace")


def render_rest(request: RestRequest, variables: dict[str, Any]) -> RestRequest:
    return RestRequest.model_validate(render_data(request.model_dump(), variables))


def render_tcp(request: TcpRequest, variables: dict[str, Any]) -> TcpRequest:
    return TcpRequest.model_validate(render_data(request.model_dump(), variables))


def render_mq(request: MqRequest, variables: dict[str, Any]) -> MqRequest:
    return MqRequest.model_validate(render_data(request.model_dump(), variables))


def render_db(request: DbRequest, variables: dict[str, Any]) -> DbRequest:
    return DbRequest.model_validate(render_data(request.model_dump(), variables))


def render_data(value: Any, variables: dict[str, Any]) -> Any:
    if isinstance(value, str):
        rendered = value
        for key, replacement in variables.items():
            rendered = rendered.replace("{{" + key + "}}", str(replacement))
        return rendered
    if isinstance(value, list):
        return [render_data(item, variables) for item in value]
    if isinstance(value, dict):
        return {key: render_data(item, variables) for key, item in value.items()}
    return value


def _try_json(raw: str) -> Any:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def _protocol_summary(results: list[CaseResult]) -> dict[str, int]:
    summary: dict[str, int] = {}
    for result in results:
        summary[result.protocol.value] = summary.get(result.protocol.value, 0) + 1
    return summary
