from __future__ import annotations

from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException

from .executors import ExecutionEngine
from .models import (
    Collection,
    CollectionCreate,
    Environment,
    EnvironmentCreate,
    RunReport,
    RunRequest,
    Scenario,
    ScenarioCreate,
    TestCase,
    TestCaseCreate,
)
from .store import Store

app = FastAPI(
    title="AS400 Transaction Automation Test Platform API",
    version="0.1.0",
    description="API-first automation platform for REST, TCP/IP, MQ, scenario execution, validation, and reports.",
)
store = Store()
engine = ExecutionEngine(store)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "OK"}


@app.post("/environments", response_model=Environment)
def create_environment(payload: EnvironmentCreate) -> Environment:
    environment = Environment(**payload.model_dump())
    store.save("environment", environment)
    return environment


@app.get("/environments", response_model=list[Environment])
def list_environments() -> list[Environment]:
    return store.list_environments()


@app.get("/environments/{environment_id}", response_model=Environment)
def get_environment(environment_id: str) -> Environment:
    environment = store.get_environment(environment_id)
    if not environment:
        raise HTTPException(status_code=404, detail="Environment not found")
    return environment


@app.post("/test-cases", response_model=TestCase)
def create_test_case(payload: TestCaseCreate) -> TestCase:
    test_case = TestCase(**payload.model_dump())
    store.save("case", test_case)
    return test_case


@app.get("/test-cases", response_model=list[TestCase])
def list_test_cases() -> list[TestCase]:
    return store.list_cases()


@app.get("/test-cases/{case_id}", response_model=TestCase)
def get_test_case(case_id: str) -> TestCase:
    test_case = store.get_case(case_id)
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
    return test_case


@app.post("/scenarios", response_model=Scenario)
def create_scenario(payload: ScenarioCreate) -> Scenario:
    scenario = Scenario(**payload.model_dump())
    store.save("scenario", scenario)
    return scenario


@app.get("/scenarios", response_model=list[Scenario])
def list_scenarios() -> list[Scenario]:
    return store.list_scenarios()


@app.get("/scenarios/{scenario_id}", response_model=Scenario)
def get_scenario(scenario_id: str) -> Scenario:
    scenario = store.get_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@app.post("/collections", response_model=Collection)
def create_collection(payload: CollectionCreate) -> Collection:
    collection = Collection(
        name=payload.name,
        description=payload.description,
        test_cases=[],
        scenarios=[],
    )
    for item in payload.test_cases:
        test_case = TestCase(**item.model_dump())
        store.save("case", test_case)
        collection.test_cases.append(test_case)
    for item in payload.scenarios:
        scenario = Scenario(**item.model_dump())
        store.save("scenario", scenario)
        collection.scenarios.append(scenario)
    store.save("collection", collection)
    return collection


@app.get("/collections", response_model=list[Collection])
def list_collections() -> list[Collection]:
    return store.list_collections()


@app.get("/collections/{collection_id}", response_model=Collection)
def get_collection(collection_id: str) -> Collection:
    collection = store.get_collection(collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection


@app.post("/runs/test-cases/{case_id}", response_model=RunReport)
def run_single_case(case_id: str, payload: RunRequest | None = None) -> RunReport:
    payload = payload or RunRequest()
    test_case = store.get_case(case_id)
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
    environment = _load_environment(payload.environment_id)
    started_at = _now()
    result = engine.run_case(test_case, environment)
    return engine.build_report(payload.environment_id, [result], [], started_at)


@app.post("/runs/scenarios/{scenario_id}", response_model=RunReport)
def run_single_scenario(scenario_id: str, payload: RunRequest | None = None) -> RunReport:
    payload = payload or RunRequest()
    scenario = store.get_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    environment = _load_environment(payload.environment_id)
    started_at = _now()
    result = engine.run_scenario(scenario, environment)
    return engine.build_report(payload.environment_id, [], [result], started_at)


@app.post("/runs/batch", response_model=RunReport)
def run_batch(payload: RunRequest) -> RunReport:
    environment = _load_environment(payload.environment_id)
    case_ids = list(payload.test_case_ids or [])
    scenario_ids = list(payload.scenario_ids or [])
    if payload.collection_id:
        collection = store.get_collection(payload.collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        case_ids.extend(item.id for item in collection.test_cases)
        scenario_ids.extend(item.id for item in collection.scenarios)

    started_at = _now()
    case_results = []
    for case_id in case_ids:
        test_case = store.get_case(case_id)
        if not test_case:
            raise HTTPException(status_code=404, detail=f"Test case not found: {case_id}")
        result = engine.run_case(test_case, environment)
        case_results.append(result)
        if payload.stop_on_failure and not result.passed:
            return engine.build_report(payload.environment_id, case_results, [], started_at)

    scenario_results = []
    for scenario_id in scenario_ids:
        scenario = store.get_scenario(scenario_id)
        if not scenario:
            raise HTTPException(status_code=404, detail=f"Scenario not found: {scenario_id}")
        result = engine.run_scenario(scenario, environment)
        scenario_results.append(result)
        if payload.stop_on_failure and not result.passed:
            break

    return engine.build_report(payload.environment_id, case_results, scenario_results, started_at)


@app.get("/reports", response_model=list[RunReport])
def list_reports() -> list[RunReport]:
    return store.list_reports()


@app.get("/reports/{report_id}", response_model=RunReport)
def get_report(report_id: str) -> RunReport:
    report = store.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


def _load_environment(environment_id: str | None) -> Environment | None:
    if not environment_id:
        return None
    environment = store.get_environment(environment_id)
    if not environment:
        raise HTTPException(status_code=404, detail="Environment not found")
    return environment


def _now() -> str:
    return datetime.now(UTC).isoformat()

