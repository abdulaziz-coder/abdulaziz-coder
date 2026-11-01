from temporalio import activity

from .db import EnquiryRecord, Session


@activity.defn
async def prepare_enquiry(enquiry_id: str) -> str:
    async with Session() as db:
        record = await db.get(EnquiryRecord, enquiry_id)
        if record is None:
            # An admin may delete an enquiry before its queued activity runs.
            return "deleted"
        # Idempotent under Temporal retries. No external emails or notifications are sent.
        record.status = "ready_for_review"
        await db.commit()
    return "ready_for_review"
