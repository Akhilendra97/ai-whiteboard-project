from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Use DATABASE_URL from Railway (or fallback to local SQLite)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./diagrams.db")

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL)

# Session for DB operations
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()
