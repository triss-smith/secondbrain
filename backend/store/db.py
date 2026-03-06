import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from backend.config import settings

engine = create_engine(
    f"sqlite:///{settings.db_path}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Item(Base):
    __tablename__ = "items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    source_url = Column(String)
    # youtube | tiktok | instagram | pdf | article | podcast | github | gdocs | note | linkedin
    content_type = Column(String, nullable=False)
    content = Column(Text)
    summary = Column(Text)
    thumbnail = Column(String)
    tags = Column(JSON, default=list)
    category = Column(String, default="")
    meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    chunks = relationship("Chunk", back_populates="item", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    item_id = Column(String, ForeignKey("items.id"), nullable=False)
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)

    item = relationship("Item", back_populates="chunks")


class Board(Base):
    __tablename__ = "boards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, default="My Brain")
    # React Flow serialised state: { nodes: [...], edges: [...] }
    state = Column(JSON, default=lambda: {"nodes": [], "edges": []})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Page(Base):
    __tablename__ = "pages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False, default="Untitled Page")
    content = Column(Text, default="")
    board_id = Column(String, ForeignKey("boards.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


Base.metadata.create_all(bind=engine)

# Migrate existing tables — add columns that may not exist yet
with engine.connect() as conn:
    existing = [row[1] for row in conn.execute(__import__('sqlalchemy').text("PRAGMA table_info(items)"))]
    if "category" not in existing:
        conn.execute(__import__('sqlalchemy').text("ALTER TABLE items ADD COLUMN category TEXT DEFAULT ''"))
        conn.commit()
