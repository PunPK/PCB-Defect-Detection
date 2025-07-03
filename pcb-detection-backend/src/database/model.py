from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    create_engine,
    ForeignKey,
    DECIMAL,
    LargeBinary,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

engine = create_engine(
    "sqlite:///pcb-detection-backend/database.db/images.db", echo=True
)
Base = declarative_base()


class ImagePCB(Base):
    __tablename__ = "imagepcb"

    image_id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    pcb_id = Column(Integer, ForeignKey("pcb.id"))

    pcb = relationship("PCB", back_populates="images", foreign_keys=[pcb_id])


class Result(Base):
    __tablename__ = "result"

    results_id = Column(Integer, primary_key=True, index=True)
    pcb_result_id = Column(Integer, ForeignKey("pcb.id"))
    accuracy = Column(DECIMAL(5, 2))
    description = Column(String)
    template_image = Column(Integer, ForeignKey("imagepcb.image_id"))
    defective_image = Column(Integer, ForeignKey("imagepcb.image_id"))
    aligned_image = Column(Integer, ForeignKey("imagepcb.image_id"))
    diff_image = Column(Integer, ForeignKey("imagepcb.image_id"))
    cleaned_image = Column(Integer, ForeignKey("imagepcb.image_id"))
    result_image = Column(Integer, ForeignKey("imagepcb.image_id"))

    pcb = relationship("PCB", back_populates="result", foreign_keys=[pcb_result_id])


class PCB(Base):
    __tablename__ = "pcb"

    id = Column(Integer, primary_key=True, index=True)
    create_at = Column(DateTime, default=datetime.utcnow)
    # originalPcb = relationship("ImagePCB", back_populates="pcb")

    originalPcb = Column(Integer, ForeignKey("imagepcb.image_id"))
    # original_filename = Column(String)
    # originalPcb_data = Column(LargeBinary)
    result_id = Column(Integer, ForeignKey("result.results_id"))

    result = relationship(
        "Result", back_populates="pcb", foreign_keys=[Result.pcb_result_id]
    )
    images = relationship(
        "ImagePCB", back_populates="pcb", foreign_keys=[ImagePCB.pcb_id]
    )


Base.metadata.create_all(engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
