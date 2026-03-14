import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, create_engine
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
    formatted_content = Column(Text)
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


class Connection(Base):
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_item_id = Column(String, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    target_item_id = Column(String, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False, default="related")
    is_semantic = Column(Boolean, nullable=False, default=False)  # true = from similarity, not user-created
    dismissed = Column(Boolean, nullable=False, default=False)    # true = user dismissed this semantic edge
    similarity = Column(Float, nullable=True)  # similarity score for semantic edges
    auto_generated = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (
        UniqueConstraint('source_item_id', 'target_item_id', name='uq_connection_pair'),
    )


Base.metadata.create_all(bind=engine)

# Migrate existing tables — add columns that may not exist yet
with engine.connect() as conn:
    existing = [row[1] for row in conn.execute(__import__('sqlalchemy').text("PRAGMA table_info(items)"))]
    if "category" not in existing:
        conn.execute(__import__('sqlalchemy').text("ALTER TABLE items ADD COLUMN category TEXT DEFAULT ''"))
        conn.commit()
    if "formatted_content" not in existing:
        conn.execute(__import__('sqlalchemy').text("ALTER TABLE items ADD COLUMN formatted_content TEXT"))
        conn.commit()

with engine.connect() as conn:
    conn_cols = [row[1] for row in conn.execute(__import__('sqlalchemy').text("PRAGMA table_info(connections)"))]
    if "auto_generated" not in conn_cols:
        conn.execute(__import__('sqlalchemy').text(
            "ALTER TABLE connections ADD COLUMN auto_generated INTEGER NOT NULL DEFAULT 0"
        ))
        conn.commit()
    if "is_semantic" not in conn_cols:
        conn.execute(__import__('sqlalchemy').text(
            "ALTER TABLE connections ADD COLUMN is_semantic INTEGER NOT NULL DEFAULT 0"
        ))
        conn.commit()
    if "dismissed" not in conn_cols:
        conn.execute(__import__('sqlalchemy').text(
            "ALTER TABLE connections ADD COLUMN dismissed INTEGER NOT NULL DEFAULT 0"
        ))
        conn.commit()
    if "similarity" not in conn_cols:
        conn.execute(__import__('sqlalchemy').text(
            "ALTER TABLE connections ADD COLUMN similarity REAL"
        ))
        conn.commit()
