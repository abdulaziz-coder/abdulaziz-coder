import asyncio


def loop_factory():
    """Psycopg async requires a selector loop, including on Windows."""
    return asyncio.SelectorEventLoop()
