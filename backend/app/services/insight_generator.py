import pandas as pd
import numpy as np
import math
from scipy import stats

def generate_dataset_insights(df: pd.DataFrame, col_types: dict) -> list:
    """
    Analyzes a DataFrame and column types to generate a list of structured insights.
    Each insight is a dict: {"type": str, "title": str, "message": str, "severity": str}
    """
    insights = []
    
    # Pre-analysis: Data Quality Checks & Exclusions
    unsuitable_cols = set()
    constant_cols = []
    zero_variance_cols = []
    high_cardinality_cols = []
    
    # 1. Detect missing values & duplicates at the dataset level
    missing_sum = int(df.isna().sum().sum())
    if missing_sum > 0:
        missing_pct = (missing_sum / (df.shape[0] * df.shape[1])) * 100
        insights.append({
            "type": "cleaning",
            "title": "Missing Data Detected",
            "message": f"There are {missing_sum} missing values across the dataset ({missing_pct:.2f}% of total cells). Consider replacing or filling them.",
            "severity": "warning"
        })
        
    dup_sum = int(df.duplicated().sum())
    if dup_sum > 0:
        insights.append({
            "type": "cleaning",
            "title": "Duplicate Rows Detected",
            "message": f"Found {dup_sum} exact duplicate rows. Cleaning them will prevent statistical bias in your reports.",
            "severity": "warning"
        })
        
    # Analyze columns for quality
    for col in df.columns:
        series = df[col].dropna()
        if series.empty:
            unsuitable_cols.add(col)
            continue
            
        unique_count = series.nunique()
        
        # Check constant column
        if unique_count <= 1:
            constant_cols.append(col)
            unsuitable_cols.add(col)
            insights.append({
                "type": "quality",
                "title": f"Constant Column '{col}'",
                "message": f"Column '{col}' has only one unique value and has been excluded from statistical analysis.",
                "severity": "info"
            })
            continue
            
        # Check zero-variance for numeric columns
        if pd.api.types.is_numeric_dtype(df[col]) and col_types.get(col) == "Numerical Measure":
            std_dev = series.std()
            if pd.isna(std_dev) or std_dev == 0:
                zero_variance_cols.append(col)
                unsuitable_cols.add(col)
                insights.append({
                    "type": "quality",
                    "title": f"Zero Variance in '{col}'",
                    "message": f"Column '{col}' has zero variance (all values are identical) and has been excluded from statistical analysis.",
                    "severity": "info"
                })
                continue
                
        # Check high-cardinality categorical
        if col_types.get(col) == "Categorical":
            cardinality_ratio = unique_count / len(df)
            if unique_count > 30 and cardinality_ratio > 0.2:
                high_cardinality_cols.append(col)
                unsuitable_cols.add(col)
                insights.append({
                    "type": "quality",
                    "title": f"High Cardinality in '{col}'",
                    "message": f"Categorical column '{col}' has high cardinality ({unique_count} unique values). Excluded from aggregation analysis.",
                    "severity": "info"
                })
                
    # Filter columns to process (strictly excluding IDs and unsuitable columns)
    numerical_cols = [
        col for col, t in col_types.items() 
        if t == "Numerical Measure" and col in df.columns and col not in unsuitable_cols
    ]
    categorical_cols = [
        col for col, t in col_types.items() 
        if t == "Categorical" and col in df.columns and col not in unsuitable_cols
    ]
    datetime_cols = [
        col for col, t in col_types.items() 
        if t == "Date/Time" and col in df.columns and col not in unsuitable_cols
    ]
    
    # 2. Outlier Detection (using IQR)
    for col in numerical_cols:
        series = df[col].dropna()
        if len(series) < 5:
            continue
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        outliers = series[(series < lower_bound) | (series > upper_bound)]
        if len(outliers) > 0:
            outlier_pct = (len(outliers) / len(series)) * 100
            insights.append({
                "type": "outlier",
                "title": f"Outliers in '{col}'",
                "message": f"Detected {len(outliers)} outliers. Method: IQR. Lower Bound: {lower_bound:.2f}. Upper Bound: {upper_bound:.2f}. Percentage: {outlier_pct:.2f}%. Interpretation: These observations are unusual but may still be valid.",
                "severity": "info" if outlier_pct < 5 else "warning"
            })
            
    # 3. Distribution Analysis
    for col in numerical_cols:
        series = df[col].dropna()
        if len(series) < 10:
            continue
        try:
            mean_val = float(series.mean())
            median_val = float(series.median())
            std_val = float(series.std())
            skew = float(stats.skew(series))
            kurt = float(stats.kurtosis(series))
            
            if abs(skew) < 0.25:
                skew_desc = "is approximately normally distributed"
            elif 0.25 <= skew < 0.75:
                skew_desc = "shows a slightly right-skewed distribution"
            elif skew >= 0.75:
                skew_desc = "shows a strongly right-skewed distribution"
            elif -0.75 < skew <= -0.25:
                skew_desc = "shows a slightly left-skewed distribution"
            else:
                skew_desc = "shows a strongly left-skewed distribution"
                
            insights.append({
                "type": "distribution",
                "title": f"Distribution of '{col}'",
                "message": f"'{col}' {skew_desc} (Mean: {mean_val:.2f}, Median: {median_val:.2f}, Std Dev: {std_val:.2f}, Skewness: {skew:.2f}, Kurtosis: {kurt:.2f}).",
                "severity": "info"
            })
        except Exception:
            pass
            
    # 4. Categorical Breakdown (Dominance)
    for col in categorical_cols:
        series = df[col].dropna()
        if len(series) < 5:
            continue
        counts = series.value_counts()
        if len(counts) > 0:
            top_cat = counts.index[0]
            top_count = counts.iloc[0]
            top_pct = (top_count / len(series)) * 100
            
            if top_pct >= 40.0:
                insights.append({
                    "type": "categorical",
                    "title": f"Dominant Category in '{col}'",
                    "message": f"Category '{top_cat}' is highly dominant in column '{col}', accounting for {top_pct:.1f}% of all records.",
                    "severity": "info"
                })
            elif len(counts) > 1:
                least_cat = counts.index[-1]
                least_count = counts.iloc[-1]
                least_pct = (least_count / len(series)) * 100
                insights.append({
                    "type": "categorical",
                    "title": f"Category Distribution: '{col}'",
                    "message": f"In '{col}', '{top_cat}' is the most frequent ({top_pct:.1f}%), while '{least_cat}' is the least frequent ({least_pct:.1f}%).",
                    "severity": "info"
                })
                
    # 5. Correlation Analysis (Pearson with p-value & Fisher z confidence interval)
    correlation_insights = []
    if len(numerical_cols) >= 2:
        try:
            cols = list(numerical_cols)
            for i in range(len(cols)):
                for j in range(i + 1, len(cols)):
                    col1 = cols[i]
                    col2 = cols[j]
                    
                    # Remove pairwise NaNs
                    clean_pair = df[[col1, col2]].dropna()
                    if len(clean_pair) < 5:
                        continue
                        
                    x = clean_pair[col1].values
                    y = clean_pair[col2].values
                    
                    r, p_val = stats.pearsonr(x, y)
                    
                    if not pd.isna(r) and abs(r) >= 0.30:
                        if r >= 0.70:
                            strength, direction = "Strong", "Positive"
                        elif r >= 0.50:
                            strength, direction = "Moderate", "Positive"
                        elif r >= 0.30:
                            strength, direction = "Weak", "Positive"
                        elif r <= -0.70:
                            strength, direction = "Strong", "Negative"
                        elif r <= -0.50:
                            strength, direction = "Moderate", "Negative"
                        else:
                            strength, direction = "Weak", "Negative"
                            
                        # Fisher z-transformation confidence interval (95%)
                        r_clamped = max(-0.9999, min(0.9999, r))
                        z = 0.5 * math.log((1 + r_clamped) / (1 - r_clamped))
                        se = 1.0 / math.sqrt(len(clean_pair) - 3) if len(clean_pair) > 3 else 0.0
                        z_lower = z - 1.96 * se
                        z_upper = z + 1.96 * se
                        r_lower = math.tanh(z_lower)
                        r_upper = math.tanh(z_upper)
                        
                        sig_text = "Statistically Significant" if p_val < 0.05 else "Not Statistically Significant"
                        
                        correlation_insights.append({
                            "val": abs(r),
                            "insight": {
                                "type": "correlation",
                                "title": f"Relationship: {col1} ↔ {col2}",
                                "message": f"There is a {strength} {direction} relationship between '{col1}' and '{col2}' (Correlation r = {r:.2f}, P-value = {p_val:.4e}, {sig_text}). 95% Confidence Interval: [{r_lower:.2f}, {r_upper:.2f}].",
                                "severity": "info"
                            }
                        })
            
            correlation_insights.sort(key=lambda x: x["val"], reverse=True)
            insights.extend([c["insight"] for c in correlation_insights])
        except Exception:
            pass
            
    # 6. Trend Analysis (Time-series)
    if datetime_cols and numerical_cols:
        time_col = datetime_cols[0]
        for num_col in numerical_cols:
            try:
                temp = df[[time_col, num_col]].dropna()
                temp[time_col] = pd.to_datetime(temp[time_col], errors='coerce')
                temp = temp.dropna().sort_values(by=time_col)
                if len(temp) >= 10:
                    y = temp[num_col].values
                    x = temp[time_col].astype(np.int64).values / 10**9 # in seconds
                    
                    slope, intercept, r_val, p_val, std_err = stats.linregress(x, y)
                    if p_val < 0.05 and abs(r_val) > 0.3:
                        direction = "upward" if slope > 0 else "downward"
                        insights.append({
                            "type": "trend",
                            "title": f"Time-series Trend: '{num_col}'",
                            "message": f"'{num_col}' shows a statistically significant {direction} trend over time when mapped against '{time_col}'.",
                            "severity": "info"
                        })
            except Exception:
                pass
                
    # Fallback default insight if list is empty
    if not insights:
        insights.append({
            "type": "general",
            "title": "Dataset Ready",
            "message": "Your dataset is clean and structured. Select columns to build charts and visualize distributions.",
            "severity": "info"
        })
        
    return insights
