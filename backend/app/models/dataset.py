import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database.connection import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    
    # Store detected column classifications, summary metrics, and history
    columns_metadata = Column(JSON, nullable=True) # e.g. {"col1": "Numerical", "col2": "Categorical"}
    summary_stats = Column(JSON, nullable=True)    # e.g. {"rows": 100, "cols": 5, "missing": 12}
    cleaning_history = Column(JSON, nullable=True) # List of actions for undo/redo
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    owner = relationship("User", back_populates="datasets")
