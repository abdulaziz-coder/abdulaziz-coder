import asyncio

from .db import Base, engine
from .runtime import loop_factory


async def main():
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("Local admissions database initialized.")


if __name__ == "__main__":
    asyncio.run(main(), loop_factory=loop_factory)
