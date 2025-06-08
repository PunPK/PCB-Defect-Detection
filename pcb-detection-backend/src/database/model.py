from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    create_engine,
    ForeignKey,
    DECIMAL,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

engine = create_engine("sqlite:///database.db", echo=True)
Base = declarative_base()


class PCB(Base):
    __tablename__ = "pcb"

    id = Column(Integer, primary_key=True, index=True)
    datetime = Column(DateTime, default=datetime.utcnow)
    OriginalPcb = Column(Integer)
    result_id = Column(Integer, ForeignKey("result.results_id"))

    result = relationship("Result", back_populates="pcb")
    images = relationship("ImagePCB", back_populates="pcb")


class Result(Base):
    __tablename__ = "result"

    results_id = Column(Integer, primary_key=True, index=True)
    accuracy = Column(DECIMAL(5, 2))
    description = Column(String)
    pcb_analysis = Column(Integer)

    pcb = relationship("PCB", back_populates="result")


class ImagePCB(Base):
    __tablename__ = "imagePcb"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    filepath = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    pcb_id = Column(Integer, ForeignKey("pcb.id"))

    pcb = relationship("PCB", back_populates="images")


# class Image(Base):
#     __tablename__ = "images"

#     id = Column(Integer, primary_key=True, index=True)
#     filename = Column(String, unique=True, index=True)
#     filepath = Column(String)
#     uploaded_at = Column(DateTime, default=datetime.utcnow)


# class Challenge(Base):
#     __tablename__ = "challenges"

#     id = Column(Integer, primary_key=True)
#     difficulty = Column(String, nullable=False)
#     date_created = Column(DateTime, default=datetime.now)
#     created_by = Column(String, nullable=False)
#     title = Column(String, nullable=False)
#     options = Column(String, nullable=False)
#     correct_answer_id = Column(Integer, nullable=False)
#     explanation = Column(String, nullable=False)


# class ChallengeQuota(Base):
#     __tablename__ = "challenge_quotas"

#     id = Column(Integer, primary_key=True)
#     user_id = Column(String, nullable=False, unique=True)
#     quota_remaining = Column(Integer, nullable=False, default=50)
#     last_reset_date = Column(DateTime, default=datetime.now)


# Base.metadata.create_all(engine)

# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()
