import pandas as pd
import numpy as np

def apply_cleaning_operation(df: pd.DataFrame, action: str, params: dict) -> pd.DataFrame:
    """
    Applies a single cleaning action to a DataFrame.
    """
    df = df.copy()
    
    if action == "remove_duplicates":
        df = df.drop_duplicates()
        
    elif action == "drop_column":
        col = params.get("column")
        if col in df.columns:
            df = df.drop(columns=[col])
            
    elif action == "rename_column":
        col = params.get("column")
        new_name = params.get("new_name")
        if col in df.columns and new_name:
            df = df.rename(columns={col: new_name})
            
    elif action == "trim_spaces":
        col = params.get("column")
        if col in df.columns:
            # Only apply to string/object columns
            if pd.api.types.is_object_dtype(df[col]):
                df[col] = df[col].astype(str).str.strip()
                
    elif action == "delete_nulls":
        col = params.get("column")
        if col:
            if col in df.columns:
                df = df.dropna(subset=[col])
        else:
            df = df.dropna()
            
    elif action == "fill_missing":
        col = params.get("column")
        method = params.get("method") # "mean", "median", "mode", "value"
        fill_val = params.get("value")
        
        if col in df.columns:
            if method in ("mean", "median"):
                numeric_series = pd.to_numeric(df[col], errors='coerce')
                if not numeric_series.dropna().empty:
                    stat_val = numeric_series.mean() if method == "mean" else numeric_series.median()
                    df[col] = df[col].fillna(stat_val)
                    if not pd.api.types.is_numeric_dtype(df[col]):
                        df[col] = pd.to_numeric(df[col], errors='coerce')
            elif method == "mode":
                mode_series = df[col].mode()
                if not mode_series.empty:
                    df[col] = df[col].fillna(mode_series[0])
            elif method == "value":
                val = fill_val
                try:
                    if '.' in str(fill_val):
                        val = float(fill_val)
                    else:
                        val = int(fill_val)
                except ValueError:
                    pass
                df[col] = df[col].fillna(val)
                
    elif action == "convert_type":
        col = params.get("column")
        to_type = params.get("to_type") # "Numerical", "Categorical", "Date/Time", "Boolean", "Text"
        
        if col in df.columns:
            try:
                if to_type == "Numerical":
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                elif to_type == "Categorical":
                    df[col] = df[col].astype(str).astype('category')
                elif to_type == "Date/Time":
                    df[col] = pd.to_datetime(df[col], errors='coerce')
                elif to_type == "Boolean":
                    def to_bool(val):
                        if pd.isna(val):
                            return np.nan
                        s = str(val).strip().lower()
                        if s in ('true', '1', 'y', 'yes', 't'):
                            return True
                        if s in ('false', '0', 'n', 'no', 'f'):
                            return False
                        return bool(val)
                    df[col] = df[col].apply(to_bool).astype('boolean')
                elif to_type == "Text":
                    df[col] = df[col].astype(str)
            except Exception:
                pass
                
    return df

def replay_cleaning_history(original_df: pd.DataFrame, history: list) -> pd.DataFrame:
    """
    Takes the original DataFrame and replays all cleaning operations in the history.
    """
    df = original_df.copy()
    # Normalize empty or whitespace strings in object columns to NaN
    for col in df.columns:
        if pd.api.types.is_object_dtype(df[col]):
            df[col] = df[col].replace(r'^\s*$', np.nan, regex=True)
            
    for operation in history:
        action = operation.get("action")
        params = operation.get("params", {})
        df = apply_cleaning_operation(df, action, params)
    return df
