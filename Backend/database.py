from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Railway provides DATABASE_URL automatically when you add PostgreSQL plugin
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")  
# Fallback to SQLite if DATABASE_URL is not set (for local dev)

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL)

# Session for DB operations
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()
