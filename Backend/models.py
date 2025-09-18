from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)

    diagrams = relationship("Diagram", back_populates="owner")


class Diagram(Base):
    __tablename__ = "diagrams"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, default="Untitled")
    image = Column(String)  # Base64 Image
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="diagrams")
