from __future__ import annotations

import tempfile
import unittest

from as400_test_platform.executors import ExecutionEngine
from as400_test_platform.models import (
    DbRequest,
    Environment,
    Protocol,
    TestCase,
    TcpRequest,
    TransactionRequest,
    ValidationRule,
    MqRequest,
)
from as400_test_platform.store import Store


class ExecutionEngineTest(unittest.TestCase):
    def test_mq_simulation_case_passes_with_validation(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(f"{tmp}/platform.sqlite3")
            engine = ExecutionEngine(store)
            case = TestCase(
                name="MQ settlement",
                request=TransactionRequest(
                    protocol=Protocol.MQ,
                    mq=MqRequest(
                        queue_manager="QM1",
                        request_queue="DEV.REQUEST",
                        payload="hello",
                        correlation_id="C100",
                    ),
                ),
                validations=[
                    ValidationRule(
                        name="Correlation exists",
                        source="mqmd",
                        path="correlation_id",
                        operator="exists",
                    )
                ],
            )

            result = engine.run_case(case)

            self.assertTrue(result.passed)
            self.assertEqual(result.response.protocol, Protocol.MQ)

    def test_environment_variables_are_rendered(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(f"{tmp}/platform.sqlite3")
            engine = ExecutionEngine(store)
            env = Environment(name="SIT", variables={"queue": "DEV.REQUEST"})
            case = TestCase(
                name="MQ with variables",
                request=TransactionRequest(
                    protocol=Protocol.MQ,
                    mq=MqRequest(
                        queue_manager="QM1",
                        request_queue="{{queue}}",
                        payload="payload",
                    ),
                ),
                validations=[
                    ValidationRule(
                        name="Queue rendered",
                        source="mqmd",
                        path="request_queue",
                        operator="equals",
                        expected="DEV.REQUEST",
                    )
                ],
            )

            result = engine.run_case(case, env)

            self.assertTrue(result.passed)

    def test_tcp_mock_response_passes_without_socket(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(f"{tmp}/platform.sqlite3")
            engine = ExecutionEngine(store)
            case = TestCase(
                name="TCP auth approved",
                request=TransactionRequest(
                    protocol=Protocol.TCP,
                    tcp=TcpRequest(
                        host="{{as400_host}}",
                        port=9001,
                        payload="AUTH|TXN10001|100.00",
                        mock_response="AUTHRESP|TXN10001|APPROVED|00|APPR123456",
                    ),
                ),
                validations=[
                    ValidationRule(
                        name="TCP approval code",
                        source="text",
                        operator="contains",
                        expected="APPROVED",
                    )
                ],
            )

            result = engine.run_case(case, Environment(name="SIT", variables={"as400_host": "mock-as400"}))

            self.assertTrue(result.passed)
            self.assertTrue(result.response.metadata["mocked"])

    def test_db_mock_rows_support_backend_validation(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(f"{tmp}/platform.sqlite3")
            engine = ExecutionEngine(store)
            case = TestCase(
                name="DB validation",
                request=TransactionRequest(
                    protocol=Protocol.DB,
                    db=DbRequest(
                        connection="data/backend.sqlite3",
                        query="select * from authorization_result where transaction_id = ?",
                        parameters=["TXN10001"],
                        mock_rows=[{"transaction_id": "TXN10001", "status": "POSTED", "response_code": "00"}],
                    ),
                ),
                validations=[
                    ValidationRule(name="Backend row exists", source="db", path="row_count", operator="equals", expected=1),
                    ValidationRule(
                        name="Backend status posted",
                        source="db",
                        path="rows.0.status",
                        operator="equals",
                        expected="POSTED",
                    ),
                ],
            )

            result = engine.run_case(case)

            self.assertTrue(result.passed)


if __name__ == "__main__":
    unittest.main()
