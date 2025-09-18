from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Railway will inject DATABASE_URL for PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./diagrams.db")

# Create engine (SQLite needs special connect args)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

# DB session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()
