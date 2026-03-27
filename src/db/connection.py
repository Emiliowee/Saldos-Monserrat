from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from src.core.paths import DB_PATH

_db_url = f"sqlite:///{DB_PATH.resolve().as_posix()}"
engine = create_engine(_db_url, echo=False)
SessionLocal = sessionmaker(bind=engine)


def get_session() -> Session:
    return SessionLocal()
