from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password = Column(String(100), nullable=False)
    diagrams = relationship("Diagram", back_populates="owner")

class Diagram(Base):
    __tablename__ = "diagrams"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)  # save JSON/base64 drawing
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="diagrams")
