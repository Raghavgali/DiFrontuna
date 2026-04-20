from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(settings.database_url, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from sqlalchemy import inspect, text

    from app.storage import models  # noqa: F401 — register mappers

    Base.metadata.create_all(bind=engine)

    # Tiny in-place migration: add `tickets.number` on pre-existing SQLite DBs
    # and backfill it from rowid order so older tickets get stable numbers.
    with engine.begin() as conn:
        cols = {c["name"] for c in inspect(conn).get_columns("tickets")}
        if "number" not in cols:
            conn.execute(text("ALTER TABLE tickets ADD COLUMN number INTEGER DEFAULT 0"))
            conn.execute(
                text(
                    "UPDATE tickets SET number = ("
                    "  SELECT COUNT(*) FROM tickets t2 "
                    "  WHERE t2.created_at <= tickets.created_at"
                    ")"
                )
            )
