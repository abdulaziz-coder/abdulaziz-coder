import asyncio
from sqlalchemy import text

from .db import Base, engine
from .runtime import loop_factory


async def main():
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        # Additive, repeatable upgrade for local databases created before grade selection.
        await connection.execute(text(
            "ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS grade INTEGER "
            "CONSTRAINT ck_enquiries_grade CHECK (grade BETWEEN 1 AND 11)"
        ))
    await engine.dispose()
    print("Local admissions database initialized.")


if __name__ == "__main__":
    asyncio.run(main(), loop_factory=loop_factory)
