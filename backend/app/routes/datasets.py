import os
import uuid
import json
import pandas as pd
import numpy as np
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.config import settings
from app.models.user import User
from app.models.dataset import Dataset
from app.utils.auth import get_current_user
from app.services.data_detector import detect_column_types, get_dataset_stats
from app.services.cleaner import replay_cleaning_history
from app.services.insight_generator import generate_dataset_insights
from app.services.nlq_parser import parse_natural_language_query

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Helper: load DataFrame (original or clean)
def load_dataset_df(dataset: Dataset, version: str = "clean") -> pd.DataFrame:
    file_path = dataset.file_path
    
    # If version is clean, look for the clean CSV version
    if version == "clean":
        clean_path = file_path.replace("_original", "_clean").split(".")[0] + "_clean.csv"
        if os.path.exists(clean_path):
            file_path = clean_path
            
    # Load based on type
    try:
        if file_path.endswith('.csv'):
            try:
                return pd.read_csv(file_path)
            except UnicodeDecodeError:
                try:
                    return pd.read_csv(file_path, encoding='latin-1')
                except Exception:
                    return pd.read_csv(file_path, encoding='utf-8', encoding_errors='replace')
        elif file_path.endswith(('.xlsx', '.xls')):
            return pd.read_excel(file_path)
        elif file_path.endswith('.json'):
            return pd.read_json(file_path)
        else:
            # Fallback attempt
            try:
                return pd.read_csv(file_path)
            except UnicodeDecodeError:
                try:
                    return pd.read_csv(file_path, encoding='latin-1')
                except Exception:
                    return pd.read_csv(file_path, encoding='utf-8', encoding_errors='replace')
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load dataset file: {str(e)}"
        )

def save_clean_df(dataset: Dataset, df: pd.DataFrame):
    base_path = dataset.file_path.replace("_original", "_clean").split(".")[0]
    clean_path = f"{base_path}_clean.csv"
    df.to_csv(clean_path, index=False)
    return clean_path

def apply_type_overrides_from_history(col_types: dict, history: list) -> dict:
    """
    Applies any manual 'convert_type' overrides from the history onto the detected column types.
    """
    col_types = dict(col_types)
    for step in (history or []):
        if step.get("action") == "convert_type":
            col = step.get("params", {}).get("column")
            to_type = step.get("params", {}).get("to_type")
            if to_type == "Numerical":
                to_type = "Numerical Measure"
            if col in col_types and to_type:
                col_types[col] = to_type
    return col_types

def apply_row_limit_and_sample(df: pd.DataFrame, row_limit: Optional[int], sample_method: Optional[str]) -> pd.DataFrame:
    """
    Slices or samples the dataframe based on row limit and sampling method.
    """
    if row_limit is None or row_limit <= 0 or row_limit >= len(df):
        return df
    if sample_method == "random":
        return df.sample(n=row_limit, random_state=42)
    else:
        return df.head(row_limit)

# Pydantic Schemas
class CleaningAction(BaseModel):
    action: str
    params: dict = {}

class NLQRequest(BaseModel):
    query: str
    row_limit: Optional[int] = None
    sample_method: Optional[str] = "first"

class DatasetOut(BaseModel):
    id: int
    name: str
    file_type: str
    columns_metadata: Optional[dict]
    summary_stats: Optional[dict]
    cleaning_history: Optional[List[dict]]
    created_at: str

    class Config:
        from_attributes = True


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate file type
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ['.csv', '.xlsx', '.xls', '.json']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload CSV, Excel or JSON."
        )
        
    # Generate unique ID and save file
    dataset_id = str(uuid.uuid4())
    original_filename = f"{dataset_id}_original{ext}"
    dest_path = os.path.join(settings.UPLOAD_DIR, original_filename)
    
    try:
        with open(dest_path, "wb") as f:
            content = await file.read()
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
        
    # Create database entry first to allow loading
    new_dataset = Dataset(
        name=filename,
        file_path=dest_path,
        file_type=ext[1:],
        columns_metadata={},
        summary_stats={},
        cleaning_history=[],
        owner_id=current_user.id
    )
    
    # Analyze data
    try:
        df = load_dataset_df(new_dataset, version="original")
        # Save an initial copy of clean version
        save_clean_df(new_dataset, df)
        
        # Calculate stats
        col_types = detect_column_types(df)
        stats_info = get_dataset_stats(df)
        
        new_dataset.columns_metadata = col_types
        new_dataset.summary_stats = stats_info
        
        db.add(new_dataset)
        db.commit()
        db.refresh(new_dataset)
    except Exception as e:
        # Cleanup file if failed
        if os.path.exists(dest_path):
            os.remove(dest_path)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid file content or failed processing: {str(e)}"
        )
        
    return {
        "id": new_dataset.id,
        "name": new_dataset.name,
        "file_type": new_dataset.file_type,
        "columns_metadata": new_dataset.columns_metadata,
        "summary_stats": new_dataset.summary_stats,
        "cleaning_history": new_dataset.cleaning_history
    }


@router.get("")
def list_datasets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    datasets = db.query(Dataset).filter(Dataset.owner_id == current_user.id).order_by(Dataset.created_at.desc()).all()
    return [{
        "id": d.id,
        "name": d.name,
        "file_type": d.file_type,
        "columns_metadata": d.columns_metadata,
        "summary_stats": d.summary_stats,
        "cleaning_history": d.cleaning_history,
        "created_at": d.created_at
    } for d in datasets]


@router.get("/{dataset_id}")
def get_dataset(dataset_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
        
    return {
        "id": dataset.id,
        "name": dataset.name,
        "file_type": dataset.file_type,
        "columns_metadata": dataset.columns_metadata,
        "summary_stats": dataset.summary_stats,
        "cleaning_history": dataset.cleaning_history,
        "created_at": dataset.created_at
    }


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
        
    # Delete original file
    if os.path.exists(dataset.file_path):
        os.remove(dataset.file_path)
        
    # Delete clean file
    clean_path = dataset.file_path.replace("_original", "_clean").split(".")[0] + "_clean.csv"
    if os.path.exists(clean_path):
        os.remove(clean_path)
        
    db.delete(dataset)
    db.commit()
    return {"message": "Dataset successfully deleted"}


@router.get("/{dataset_id}/preview")
def preview_dataset(
    dataset_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=10000),
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = Query("asc", regex="^(asc|desc)$"),
    row_limit: Optional[int] = Query(None),
    sample_method: Optional[str] = Query("first"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
        
    df = load_dataset_df(dataset, version="clean")
    df = apply_row_limit_and_sample(df, row_limit, sample_method)
    
    # Handle search/filtering across all text/categorical columns
    if search:
        search_lower = search.lower()
        mask = pd.Series(False, index=df.index)
        for col in df.columns:
            # Check string columns or cast to string for partial matching
            try:
                mask = mask | df[col].astype(str).str.lower().str.contains(search_lower, na=False)
            except Exception:
                pass
        df = df[mask]
        
    # Handle sorting
    if sort_by and sort_by in df.columns:
        df = df.sort_values(by=sort_by, ascending=(sort_order == "asc"))
        
    # Paginate
    total_records = len(df)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    
    paginated_df = df.iloc[start_idx:end_idx]
    
    # Replace NaNs with None for JSON serialization
    paginated_df = paginated_df.replace({np.nan: None})
    records = paginated_df.to_dict(orient="records")
    
    return {
        "total_records": total_records,
        "page": page,
        "page_size": page_size,
        "data": records
    }


@router.get("/{dataset_id}/histogram")
def get_histogram_bins(
    dataset_id: int,
    column: str,
    row_limit: Optional[int] = Query(None),
    sample_method: Optional[str] = Query("first"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
        
    df = load_dataset_df(dataset, version="clean")
    df = apply_row_limit_and_sample(df, row_limit, sample_method)
    
    if column not in df.columns:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Column '{column}' not found in dataset")
        
    col_type = (dataset.columns_metadata or {}).get(column)
    if col_type != "Numerical Measure":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Column '{column}' is classified as {col_type}. Histograms can only be generated for Numerical Measure columns."
        )
        
    series = df[column].dropna()
    if series.empty:
        return {"bins": []}
        
    n = len(series)
    val_min = float(series.min())
    val_max = float(series.max())
    
    if val_min == val_max:
        return {
            "bins": [
                {
                    "bin_range": f"{val_min:.2f} - {val_max:.2f}",
                    "count": n,
                    "min": val_min,
                    "max": val_max
                }
            ]
        }
        
    # Freedman-Diaconis: bin width h = 2 * IQR / (n ^ (1/3))
    q75, q25 = np.percentile(series, [75, 25])
    iqr = q75 - q25
    
    if iqr > 0:
        bin_width = 2 * iqr / (n ** (1/3))
        num_bins = int(np.ceil((val_max - val_min) / bin_width))
    else:
        # Sturges' Rule fallback
        num_bins = int(np.ceil(np.log2(n) + 1))
        
    # Clamp number of bins between 5 and 30 for clear visuals
    num_bins = max(5, min(30, num_bins))
    
    counts, bin_edges = np.histogram(series, bins=num_bins)
    
    bins_data = []
    for i in range(len(counts)):
        b_min = float(bin_edges[i])
        b_max = float(bin_edges[i+1])
        bins_data.append({
            "bin_range": f"{b_min:.2f} - {b_max:.2f}",
            "count": int(counts[i]),
            "min": b_min,
            "max": b_max
        })
        
    return {
        "bins": bins_data,
        "column": column,
        "total_records": n,
        "optimal_bins_count": num_bins
    }


@router.post("/{dataset_id}/clean")
def clean_dataset_route(
    dataset_id: int,
    action_in: CleaningAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
        
    # Fetch current history and append new action
    history = list(dataset.cleaning_history or [])
    new_action = {"action": action_in.action, "params": action_in.params}
    history.append(new_action)
    
    # Replay history on original file
    try:
        original_df = load_dataset_df(dataset, version="original")
        clean_df = replay_cleaning_history(original_df, history)
        
        # Save clean dataframe
        save_clean_df(dataset, clean_df)
        
        # Re-analyze and update statistics & type detection
        col_types = detect_column_types(clean_df)
        col_types = apply_type_overrides_from_history(col_types, history)
        stats_info = get_dataset_stats(clean_df, col_types)
        
        # Update database fields
        dataset.cleaning_history = history
        dataset.columns_metadata = col_types
        dataset.summary_stats = stats_info
        
        db.commit()
        db.refresh(dataset)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cleaning operation failed: {str(e)}"
        )
        
    return {
        "id": dataset.id,
        "cleaning_history": dataset.cleaning_history,
        "columns_metadata": dataset.columns_metadata,
        "summary_stats": dataset.summary_stats
    }


@router.post("/{dataset_id}/undo")
def undo_cleaning_route(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
        
    history = list(dataset.cleaning_history or [])
    if not history:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No cleaning operations to undo")
        
    # Remove the last action
    history.pop()
    
    try:
        original_df = load_dataset_df(dataset, version="original")
        clean_df = replay_cleaning_history(original_df, history)
        
        save_clean_df(dataset, clean_df)
        col_types = detect_column_types(clean_df)
        col_types = apply_type_overrides_from_history(col_types, history)
        stats_info = get_dataset_stats(clean_df, col_types)
        
        dataset.cleaning_history = history
        dataset.columns_metadata = col_types
        dataset.summary_stats = stats_info
        
        db.commit()
        db.refresh(dataset)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to undo: {str(e)}"
        )
        
    return {
        "id": dataset.id,
        "cleaning_history": dataset.cleaning_history,
        "columns_metadata": dataset.columns_metadata,
        "summary_stats": dataset.summary_stats
    }


@router.post("/{dataset_id}/reset")
def reset_dataset_route(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
        
    try:
        original_df = load_dataset_df(dataset, version="original")
        save_clean_df(dataset, original_df)
        col_types = detect_column_types(original_df)
        stats_info = get_dataset_stats(original_df)
        
        dataset.cleaning_history = []
        dataset.columns_metadata = col_types
        dataset.summary_stats = stats_info
        
        db.commit()
        db.refresh(dataset)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset: {str(e)}"
        )
        
    return {
        "id": dataset.id,
        "cleaning_history": dataset.cleaning_history,
        "columns_metadata": dataset.columns_metadata,
        "summary_stats": dataset.summary_stats
    }


@router.get("/{dataset_id}/correlation-matrix")
def get_correlation_matrix(
    dataset_id: int,
    row_limit: Optional[int] = Query(None),
    sample_method: Optional[str] = Query("first"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
        
    df = load_dataset_df(dataset, version="clean")
    df = apply_row_limit_and_sample(df, row_limit, sample_method)
    col_types = dataset.columns_metadata or {}
    
    # Filter genuine numerical columns (excluding IDs)
    numerical_cols = [
        col for col, t in col_types.items()
        if t == "Numerical Measure" and col in df.columns
    ]
    
    if len(numerical_cols) == 0:
        return {"columns": [], "matrix": []}
        
    # Calculate Pearson correlation matrix
    corr = df[numerical_cols].corr(method='pearson')
    
    matrix_data = []
    for i, col1 in enumerate(numerical_cols):
        row = []
        for j, col2 in enumerate(numerical_cols):
            val = corr.loc[col1, col2]
            if pd.isna(val):
                row.append(None)
            else:
                row.append(float(val))
        matrix_data.append(row)
        
    return {
        "columns": numerical_cols,
        "matrix": matrix_data
    }


@router.get("/{dataset_id}/insights")
def get_insights_route(
    dataset_id: int,
    row_limit: Optional[int] = Query(None),
    sample_method: Optional[str] = Query("first"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
        
    df = load_dataset_df(dataset, version="clean")
    df = apply_row_limit_and_sample(df, row_limit, sample_method)
    insights = generate_dataset_insights(df, dataset.columns_metadata or {})
    return {"insights": insights}


@router.post("/{dataset_id}/query")
def nlq_dataset_route(
    dataset_id: int,
    request: NLQRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
        
    df = load_dataset_df(dataset, version="clean")
    df = apply_row_limit_and_sample(df, request.row_limit, request.sample_method)
    col_types = dataset.columns_metadata or {}
    
    result = parse_natural_language_query(request.query, df, col_types)
    return result


@router.get("/{dataset_id}/export")
def export_dataset(
    dataset_id: int,
    format: str = Query("csv", regex="^(csv|excel)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
        
    df = load_dataset_df(dataset, version="clean")
    
    if format == "csv":
        temp_file = os.path.join(settings.UPLOAD_DIR, f"{dataset_id}_export.csv")
        df.to_csv(temp_file, index=False)
        return FileResponse(
            path=temp_file,
            filename=f"vizai_{dataset.name.split('.')[0]}_cleaned.csv",
            media_type="text/csv"
        )
    else: # excel
        temp_file = os.path.join(settings.UPLOAD_DIR, f"{dataset_id}_export.xlsx")
        df.to_excel(temp_file, index=False, engine='openpyxl')
        return FileResponse(
            path=temp_file,
            filename=f"vizai_{dataset.name.split('.')[0]}_cleaned.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

