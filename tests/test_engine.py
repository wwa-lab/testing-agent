from __future__ import annotations

import tempfile
import unittest

from as400_test_platform.executors import ExecutionEngine
from as400_test_platform.models import (
    Environment,
    Protocol,
    TestCase,
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


if __name__ == "__main__":
    unittest.main()

