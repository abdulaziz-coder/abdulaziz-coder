from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy


@workflow.defn
class AdmissionsWorkflow:
    @workflow.run
    async def run(self, enquiry_id: str) -> str:
        # Only an opaque ID is stored in workflow history; personal data stays in PostgreSQL.
        return await workflow.execute_activity(
            "prepare_enquiry", enquiry_id,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(initial_interval=timedelta(seconds=2), maximum_interval=timedelta(minutes=1)),
            result_type=str,
        )
