from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)  # Store hashed password

    # Relationship: one user → many diagrams
    diagrams = relationship("Diagram", back_populates="owner")


class Diagram(Base):
    __tablename__ = "diagrams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)  # Title of diagram
    content = Column(Text, nullable=False)  # Store JSON string of canvas data

    # Foreign key to user
    owner_id = Column(Integer, ForeignKey("users.id"))

    # Relationship back to user
    owner = relationship("User", back_populates="diagrams")
