import asyncio
import logging

from sqlalchemy import select
from temporalio.client import Client
from temporalio.common import WorkflowIDReusePolicy
from temporalio.exceptions import WorkflowAlreadyStartedError
from temporalio.worker import Worker

from .activities import prepare_enquiry
from .config import settings
from .db import EnquiryRecord, Session, engine
from .workflows import AdmissionsWorkflow
from .runtime import loop_factory

logger = logging.getLogger("bm.worker")


async def dispatch_pending(client: Client):
    """The saved row acts as a durable outbox. Retry dispatch after a process crash."""
    while True:
        try:
            async with Session() as db:
                rows = (await db.scalars(select(EnquiryRecord).where(EnquiryRecord.dispatched.is_(False)).limit(50))).all()
                for record in rows:
                    try:
                        await client.start_workflow(
                            AdmissionsWorkflow.run, record.id, id=f"admissions-{record.id}",
                            task_queue=settings.temporal_task_queue,
                            # Never start another run after a dispatch crash, even if the first run finished.
                            id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE,
                        )
                    except WorkflowAlreadyStartedError:
                        pass
                    record.dispatched = True
                    await db.commit()
        except Exception:
            logger.exception("Admissions dispatch failed; retrying in five seconds")
        await asyncio.sleep(5)


async def main():
    client = await Client.connect(settings.temporal_address, namespace=settings.temporal_namespace)
    worker = Worker(client, task_queue=settings.temporal_task_queue, workflows=[AdmissionsWorkflow], activities=[prepare_enquiry])
    try:
        async with worker:
            await dispatch_pending(client)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main(), loop_factory=loop_factory)
