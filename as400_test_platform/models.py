from __future__ import annotations

from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class Protocol(str, Enum):
    REST = "REST"
    TCP = "TCP"
    MQ = "MQ"
    DB = "DB"


class ValidationOperator(str, Enum):
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    EXISTS = "exists"
    REGEX = "regex"
    LESS_THAN = "less_than"
    GREATER_THAN = "greater_than"


class EnvironmentCreate(BaseModel):
    name: str
    description: str | None = None
    variables: dict[str, Any] = Field(default_factory=dict)
    rollback: dict[str, Any] | None = None


class Environment(EnvironmentCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))


class ValidationRule(BaseModel):
    name: str
    source: Literal["status_code", "body", "json", "text", "headers", "response_time_ms", "mqmd", "db"] = "json"
    path: str | None = None
    operator: ValidationOperator = ValidationOperator.EQUALS
    expected: Any | None = None


class RestRequest(BaseModel):
    method: str = "GET"
    url: str
    headers: dict[str, str] = Field(default_factory=dict)
    query: dict[str, Any] = Field(default_factory=dict)
    body: Any | None = None
    timeout_seconds: float = 30


class TcpRequest(BaseModel):
    host: str
    port: int
    payload: str
    encoding: Literal["ascii", "utf-8", "ebcdic", "hex"] = "utf-8"
    response_encoding: Literal["ascii", "utf-8", "ebcdic", "hex"] = "utf-8"
    timeout_seconds: float = 30
    read_bytes: int = 8192
    append_newline: bool = False


class MqRequest(BaseModel):
    queue_manager: str
    channel: str | None = None
    host: str | None = None
    port: int | None = None
    request_queue: str
    response_queue: str | None = None
    payload: str
    correlation_id: str | None = None
    timeout_seconds: float = 30
    encoding: str = "utf-8"
    simulate: bool = True


class DbRequest(BaseModel):
    driver: Literal["sqlite"] = "sqlite"
    connection: str
    query: str
    parameters: list[Any] = Field(default_factory=list)


class TransactionRequest(BaseModel):
    protocol: Protocol
    rest: RestRequest | None = None
    tcp: TcpRequest | None = None
    mq: MqRequest | None = None
    db: DbRequest | None = None


class TestCaseCreate(BaseModel):
    name: str
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    request: TransactionRequest
    validations: list[ValidationRule] = Field(default_factory=list)


class TestCase(TestCaseCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))


class ScenarioStep(BaseModel):
    name: str
    test_case_id: str | None = None
    inline_case: TestCaseCreate | None = None
    continue_on_failure: bool = False


class ScenarioCreate(BaseModel):
    name: str
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    steps: list[ScenarioStep]


class Scenario(ScenarioCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))


class CollectionCreate(BaseModel):
    name: str
    description: str | None = None
    test_cases: list[TestCaseCreate] = Field(default_factory=list)
    scenarios: list[ScenarioCreate] = Field(default_factory=list)


class Collection(CollectionCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))
    test_cases: list[TestCase] = Field(default_factory=list)
    scenarios: list[Scenario] = Field(default_factory=list)


class RunRequest(BaseModel):
    environment_id: str | None = None
    test_case_ids: list[str] | None = None
    scenario_ids: list[str] | None = None
    collection_id: str | None = None
    stop_on_failure: bool = False


class ValidationResult(BaseModel):
    name: str
    passed: bool
    actual: Any | None = None
    expected: Any | None = None
    message: str | None = None


class TransactionResponse(BaseModel):
    protocol: Protocol
    status: str
    status_code: int | None = None
    headers: dict[str, Any] = Field(default_factory=dict)
    body: Any | None = None
    raw_body: str | None = None
    response_time_ms: float
    error: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CaseResult(BaseModel):
    case_id: str
    case_name: str
    protocol: Protocol
    passed: bool
    response: TransactionResponse
    validations: list[ValidationResult]


class ScenarioResult(BaseModel):
    scenario_id: str
    scenario_name: str
    passed: bool
    steps: list[CaseResult]


class RunReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    status: Literal["PASSED", "FAILED", "PARTIAL"] = "PASSED"
    environment_id: str | None = None
    summary: dict[str, Any] = Field(default_factory=dict)
    case_results: list[CaseResult] = Field(default_factory=list)
    scenario_results: list[ScenarioResult] = Field(default_factory=list)
    started_at: str
    finished_at: str

