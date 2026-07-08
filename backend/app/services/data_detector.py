import pandas as pd
import numpy as np

def detect_column_types(df: pd.DataFrame) -> dict:
    """
    Detects the classification of each column in a DataFrame.
    Returns a dict of {column_name: data_type}
    where data_type is one of: Identifier (ID), Numerical Measure, Categorical, Boolean, Date/Time, Text.
    """
    classifications = {}
    row_count = len(df)
    
    for col in df.columns:
        series = df[col]
        
        # 1. Check if Identifier (ID)
        col_lower = col.lower()
        id_keywords = ['id', 'customerid', 'userid', 'employeeid', 'orderid', 'productid', 'invoiceid', 'transactionid', 'uuid', 'serial']
        has_id_name = any(kw in col_lower for kw in id_keywords)
        
        non_null_count = series.count()
        unique_count = series.nunique(dropna=True)
        is_unique_id = False
        is_sequential = False
        
        # Check sequential integers: e.g. 1, 2, 3, 4, 5...
        if pd.api.types.is_numeric_dtype(series) and unique_count >= 5:
            sorted_unique = np.sort(series.dropna().unique())
            if len(sorted_unique) >= 5:
                diffs = np.diff(sorted_unique)
                # If all differences are exactly 1, and values are integer-like
                if np.all(diffs == 1) and np.all(sorted_unique % 1 == 0):
                    is_sequential = True
        
        if non_null_count >= 5:
            uniqueness_ratio = unique_count / non_null_count
            is_int_or_str = (
                pd.api.types.is_integer_dtype(series) or 
                pd.api.types.is_object_dtype(series) or 
                pd.api.types.is_string_dtype(series)
            )
            # Avoid marking common numeric features (like age or salary) as IDs on small datasets
            exclude_keywords = ['age', 'salary', 'income', 'price', 'amount', 'spending', 'score', 'temp', 'value']
            is_excluded_name = any(kw in col_lower for kw in exclude_keywords)
            
            if uniqueness_ratio > 0.98 and is_int_or_str and not is_excluded_name:
                is_unique_id = True
                
        if has_id_name or is_unique_id or is_sequential:
            classifications[col] = "Identifier (ID)"
            continue
            
        # 2. Check if Boolean
        if pydtype_is_boolean(series):
            classifications[col] = "Boolean"
            continue
            
        # 3. Check if Date/Time
        if pydtype_is_datetime(series):
            classifications[col] = "Date/Time"
            continue
            
        # 4. Check if Numerical Measure
        if pd.api.types.is_numeric_dtype(series):
            if unique_count <= 2:
                classifications[col] = "Boolean"
            elif unique_count < 10 and pd.api.types.is_integer_dtype(series):
                # Avoid classifying continuous numerical features as Categorical
                exclude_keywords = ['age', 'salary', 'income', 'price', 'amount', 'spending', 'score', 'temp', 'value']
                is_excluded_name = any(kw in col_lower for kw in exclude_keywords)
                if is_excluded_name:
                    classifications[col] = "Numerical Measure"
                else:
                    classifications[col] = "Categorical"
            else:
                classifications[col] = "Numerical Measure"
            continue
            
        # 5. If Object/String, check if it can be parsed as Date/Time
        if attempt_datetime_parsing(series):
            classifications[col] = "Date/Time"
            continue
            
        # 6. Categorical vs Text based on cardinality
        if row_count > 0:
            cardinality_ratio = unique_count / row_count
        else:
            cardinality_ratio = 1.0
            
        if unique_count < 25 or cardinality_ratio < 0.15:
            classifications[col] = "Categorical"
        else:
            classifications[col] = "Text"
            
    return classifications

def pydtype_is_boolean(series: pd.Series) -> bool:
    if pd.api.types.is_bool_dtype(series):
        return True
    non_null = series.dropna()
    if len(non_null) == 0:
        return False
    unique_vals = set(non_null.unique())
    boolean_sets = [
        {True, False},
        {0, 1},
        {"true", "false"},
        {"True", "False"},
        {"y", "n"},
        {"yes", "no"}
    ]
    for b_set in boolean_sets:
        if unique_vals.issubset(b_set):
            return True
    return False

def pydtype_is_datetime(series: pd.Series) -> bool:
    return pd.api.types.is_datetime64_any_dtype(series) or pd.api.types.is_timedelta64_dtype(series)

def attempt_datetime_parsing(series: pd.Series) -> bool:
    sample = series.dropna().head(100)
    if len(sample) == 0:
        return False
    if pd.api.types.is_numeric_dtype(sample):
        return False
    try:
        converted = pd.to_datetime(sample, errors='coerce')
        success_ratio = converted.notna().sum() / len(sample)
        return success_ratio > 0.8
    except Exception:
        return False

def get_dataset_stats(df: pd.DataFrame, col_types: dict = None) -> dict:
    """
    Generates basic summary statistics of the dataset
    """
    if col_types is None:
        col_types = detect_column_types(df)
        
    row_count = len(df)
    col_count = len(df.columns)
    missing_count = int(df.isna().sum().sum())
    duplicate_count = int(df.duplicated().sum())
    memory_usage = int(df.memory_usage(deep=True).sum())
    
    # Calculate column type counts
    id_count = sum(1 for t in col_types.values() if t == "Identifier (ID)")
    num_count = sum(1 for t in col_types.values() if t == "Numerical Measure")
    cat_count = sum(1 for t in col_types.values() if t == "Categorical")
    date_count = sum(1 for t in col_types.values() if t == "Date/Time")
    
    return {
        "rows": row_count,
        "columns": col_count,
        "missing_values": missing_count,
        "duplicate_rows": duplicate_count,
        "memory_usage": memory_usage,
        "column_names": list(df.columns),
        "identifier_columns_count": id_count,
        "numerical_columns_count": num_count,
        "categorical_columns_count": cat_count,
        "date_columns_count": date_count
    }
