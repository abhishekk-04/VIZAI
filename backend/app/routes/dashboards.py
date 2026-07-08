from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.models.dashboard import Dashboard
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/dashboards", tags=["Dashboards"])

# Pydantic Schemas
class DashboardCreate(BaseModel):
    name: str = "Untitled Dashboard"
    layout: List[dict] = []

class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    layout: Optional[List[dict]] = None
    is_favorite: Optional[bool] = None

class DashboardOut(BaseModel):
    id: int
    name: str
    layout: List[dict]
    is_favorite: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.post("", response_model=DashboardOut, status_code=status.HTTP_201_CREATED)
def create_dashboard(
    dashboard_in: DashboardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_dashboard = Dashboard(
        name=dashboard_in.name,
        layout=dashboard_in.layout,
        owner_id=current_user.id
    )
    db.add(new_dashboard)
    db.commit()
    db.refresh(new_dashboard)
    
    return {
        "id": new_dashboard.id,
        "name": new_dashboard.name,
        "layout": new_dashboard.layout,
        "is_favorite": new_dashboard.is_favorite,
        "created_at": new_dashboard.created_at.isoformat(),
        "updated_at": new_dashboard.updated_at.isoformat()
    }


@router.get("", response_model=List[DashboardOut])
def list_dashboards(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dashboards = db.query(Dashboard).filter(Dashboard.owner_id == current_user.id).order_by(Dashboard.updated_at.desc()).all()
    
    result = []
    for d in dashboards:
        result.append({
            "id": d.id,
            "name": d.name,
            "layout": d.layout,
            "is_favorite": d.is_favorite,
            "created_at": d.created_at.isoformat(),
            "updated_at": d.updated_at.isoformat()
        })
    return result


@router.get("/{dashboard_id}", response_model=DashboardOut)
def get_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id, Dashboard.owner_id == current_user.id).first()
    if not dashboard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")
        
    return {
        "id": dashboard.id,
        "name": dashboard.name,
        "layout": dashboard.layout,
        "is_favorite": dashboard.is_favorite,
        "created_at": dashboard.created_at.isoformat(),
        "updated_at": dashboard.updated_at.isoformat()
    }


@router.put("/{dashboard_id}", response_model=DashboardOut)
def update_dashboard(
    dashboard_id: int,
    dashboard_in: DashboardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id, Dashboard.owner_id == current_user.id).first()
    if not dashboard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")
        
    if dashboard_in.name is not None:
        dashboard.name = dashboard_in.name
    if dashboard_in.layout is not None:
        dashboard.layout = dashboard_in.layout
    if dashboard_in.is_favorite is not None:
        dashboard.is_favorite = dashboard_in.is_favorite
        
    db.commit()
    db.refresh(dashboard)
    
    return {
        "id": dashboard.id,
        "name": dashboard.name,
        "layout": dashboard.layout,
        "is_favorite": dashboard.is_favorite,
        "created_at": dashboard.created_at.isoformat(),
        "updated_at": dashboard.updated_at.isoformat()
    }


@router.delete("/{dashboard_id}", status_code=status.HTTP_200_OK)
def delete_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id, Dashboard.owner_id == current_user.id).first()
    if not dashboard:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard not found")
        
    db.delete(dashboard)
    db.commit()
    return {"message": "Dashboard successfully deleted"}
