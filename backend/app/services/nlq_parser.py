import re
from typing import Tuple, List, Optional
import pandas as pd
import numpy as np

def stem_word(word: str) -> str:
    """
    Lightweight stemmer for common suffixes (plurals, actions).
    """
    w = word.lower().strip()
    if w.endswith('ies'):
        return w[:-3] + 'y'
    if w.endswith('s') and not w.endswith('ss'):
        return w[:-1]
    if w.endswith('ed'):
        return w[:-2]
    if w.endswith('ing'):
        return w[:-3]
    return w

def is_complete_substring(substring: str, text: str) -> bool:
    """
    Checks if a substring exists inside a text with correct word boundaries
    (i.e. not preceded or followed by alphanumeric characters or underscores).
    """
    idx = 0
    while True:
        idx = text.find(substring, idx)
        if idx == -1:
            return False
        # Check start boundary (must not be preceded by alnum or underscore)
        start_ok = (idx == 0) or (not text[idx - 1].isalnum() and text[idx - 1] != '_')
        # Check end boundary (must not be followed by alnum or underscore)
        end_ok = (idx + len(substring) == len(text)) or (not text[idx + len(substring)].isalnum() and text[idx + len(substring)] != '_')
        if start_ok and end_ok:
            return True
        idx += 1

def match_columns_in_query(query: str, columns: list) -> List[str]:
    """
    Looks for column names inside the query string using a prioritized matching strategy:
    1. Exact column name match (case-sensitive) with word boundaries
    2. Longest complete column name match (case-insensitive) with word boundaries
    3. Fuzzy/stemmed match (only if it doesn't overlap with direct matches)
    """
    query_lower = query.lower()
    
    # 1. Collect Direct/Complete Matches first
    exact_matches = []
    case_insensitive_matches = []
    
    for col in columns:
        col_lower = col.lower()
        
        # Priority 1: Exact case-sensitive match
        if col in query and is_complete_substring(col, query):
            exact_matches.append(col)
            continue
            
        # Priority 2: Exact case-insensitive match
        if col_lower in query_lower and is_complete_substring(col_lower, query_lower):
            case_insensitive_matches.append(col)
            continue
            
    direct_matches = []
    for col in exact_matches + case_insensitive_matches:
        if col not in direct_matches:
            direct_matches.append(col)
            
    # Sort direct matches by length descending
    direct_matches.sort(key=len, reverse=True)
    
    # 2. Collect Fuzzy/Stemmed matches
    fuzzy_matches = []
    query_words = re.findall(r'\w+', query_lower)
    stemmed_query_words = [stem_word(w) for w in query_words]
    
    for col in columns:
        col_stemmed = stem_word(col)
        
        # Stemmed word match
        if col_stemmed in stemmed_query_words:
            fuzzy_matches.append(col)
            continue
            
        # Partial stemmed match (only for columns longer than 3 characters)
        for sqw in stemmed_query_words:
            if len(col_stemmed) > 3 and len(sqw) >= 3 and (col_stemmed in sqw or sqw in col_stemmed):
                fuzzy_matches.append(col)
                break
                
    # Filter fuzzy matches to remove overlaps with direct matches
    valid_fuzzy = []
    direct_words = set()
    for dc in direct_matches:
        for w in re.findall(r'\w+', dc.lower()):
            direct_words.add(w)
            
    for fc in fuzzy_matches:
        if fc in direct_matches:
            continue
        fc_words = set(re.findall(r'\w+', fc.lower()))
        # If the fuzzy column shares any words with direct matches, skip it (norm/overlap protection)
        if fc_words.intersection(direct_words):
            continue
        valid_fuzzy.append(fc)
        
    # Combine direct and valid fuzzy matches
    all_matches = direct_matches + valid_fuzzy
    
    # Re-order matches based on original position in the query
    def get_pos(c):
        try:
            return query.lower().index(c.lower())
        except ValueError:
            words = re.findall(r'\w+', query.lower())
            for idx, w in enumerate(words):
                if stem_word(c) == stem_word(w) or stem_word(c) in stem_word(w):
                    return idx
            return 999
            
    unique_matches = []
    for c in sorted(all_matches, key=get_pos):
        if c not in unique_matches:
            unique_matches.append(c)
            
    return unique_matches

def detect_chart_type_intent(query: str, matched_types: List[str]) -> str:
    """
    Analyzes the query words to detect chart type intent.
    If none is specified, uses a smart default based on the matched column types.
    """
    q = query.lower()
    
    # 1. Direct keywords
    if "pie" in q or "donut" in q or "share" in q or "breakdown" in q:
        return "Pie Chart"
    if "scatter" in q or "relationship" in q or "correlation" in q or "associated" in q or "related" in q or "influence" in q or "strongly related" in q:
        return "Scatter Plot"
    if "line" in q or "trend" in q or "over time" in q or "timeline" in q or "monthly" in q or "yearly" in q:
        return "Line Chart"
    if "bar" in q or "column" in q or "compare" in q or "comparison" in q:
        return "Bar Chart"
    if "histogram" in q or "distribution" in q or "frequency" in q:
        return "Histogram"
    if "area" in q:
        return "Area Chart"
    if "box" in q or "whisker" in q:
        return "Box Plot"
    if "heatmap" in q:
        return "Heatmap"
        
    # 2. Smart default based on matched column types
    if len(matched_types) == 1:
        if matched_types[0] == "Numerical Measure":
            return "Histogram"
        else:
            return "Pie Chart" # Count of category
            
    if len(matched_types) == 2:
        t1, t2 = matched_types[0], matched_types[1]
        if t1 == "Date/Time" and t2 == "Numerical Measure":
            return "Line Chart"
        if t1 == "Numerical Measure" and t2 == "Date/Time":
            return "Line Chart"
        if t1 == "Categorical" and t2 == "Numerical Measure":
            return "Bar Chart"
        if t1 == "Numerical Measure" and t2 == "Categorical":
            return "Bar Chart"
        if t1 == "Numerical Measure" and t2 == "Numerical Measure":
            return "Scatter Plot"
            
    if len(matched_types) > 2:
        all_numeric = all(t == "Numerical Measure" for t in matched_types)
        if all_numeric:
            return "Heatmap"
            
    return "Bar Chart"

def normalize_text_for_compare(text: str) -> str:
    """
    Replaces underscores and dashes with spaces, strips special characters,
    and squeezes multiple spaces to a single space.
    """
    t = str(text).lower().replace('_', ' ').replace('-', ' ')
    t = re.sub(r'[^a-z0-9\s]', '', t)
    return ' '.join(t.split())

def detect_filters_in_query(query: str, df: pd.DataFrame, col_types: dict) -> List[dict]:
    """
    Scans categorical, text, and boolean columns to see if their normalized values
    appear in the query accompanied by filter keywords or assignment operators.
    """
    query_norm = normalize_text_for_compare(query)
    filters = []
    filter_kws = ["where", "with", "among", "in", "from", "for", "having"]
    
    # We inspect columns that are categorical, text, or boolean
    cat_cols = [c for c in df.columns if col_types.get(c) in ["Categorical", "Text", "Boolean"]]
    
    for col in cat_cols:
        col_norm = normalize_text_for_compare(col)
        col_mentioned = col_norm in query_norm
        
        # Get unique values of the column
        unique_vals = df[col].dropna().unique()
        for val in unique_vals:
            val_str = str(val)
            val_norm = normalize_text_for_compare(val_str)
            
            # Skip short values to prevent false matches
            if not val_norm.strip() or len(val_norm) < 2:
                continue
                
            # Match value as word boundary or exact substring inside the normalized query
            val_esc = re.escape(val_norm)
            if re.search(r'\b' + val_esc + r'\b', query_norm) or val_norm in query_norm:
                is_filter = False
                
                # Check filter keywords
                for kw in filter_kws:
                    if re.search(r'\b' + re.escape(kw) + r'\b', query_norm):
                        is_filter = True
                        break
                        
                # Also if it's a count query checking for categories
                if any(ck in query_norm for ck in ["how many", "count", "number of", "total"]):
                    is_filter = True
                    
                # Check if column name or assignment is in query
                if col_mentioned or "=" in query or " is " in query_norm or "equal" in query_norm:
                    is_filter = True
                    
                if is_filter:
                    filters.append({
                        "column": col,
                        "value": val,
                        "value_str": val_str
                    })
                    break
                    
    return filters

def parse_natural_language_query(query: str, df: pd.DataFrame, col_types: dict) -> dict:
    """
    Parses a natural language query against the active dataset values and column mappings.
    Returns calculated answers or chart configuration setup.
    """
    columns = list(df.columns)
    query_lower = query.lower()
    matched_cols = match_columns_in_query(query, columns)
    
    # Cache original dataset length before applying filters
    original_len = len(df)
    
    # 0. DETECT AND APPLY FILTERS
    filters = detect_filters_in_query(query, df, col_types)
    active_df = df.copy()
    filter_descriptions = []
    
    for f in filters:
        col = f["column"]
        val = f["value"]
        active_df = active_df[active_df[col] == val]
        filter_descriptions.append(f"'{col}' = '{f['value_str']}'")
        
    filter_prefix = ""
    if filter_descriptions:
        filter_prefix = "Filtered by " + " and ".join(filter_descriptions) + ". "
        
    # Re-assign df to active_df so all subsequent logic uses the filtered data
    df = active_df
    
    # 0.5. COUNT / HOW MANY / TOTAL RECORD QUERIES
    count_kws = ["how many", "count", "number of", "total"]
    is_count_query = any(re.search(r'\b' + re.escape(kw) + r'\b', query_lower) for kw in count_kws)
    # Check if they also asked for a numerical measure column (e.g. "Total Sales" is a sum aggregation)
    has_numeric_col_in_query = any(col_types.get(col) == "Numerical Measure" for col in matched_cols)
    has_grouping_kws = any(re.search(r'\b' + re.escape(gkw) + r'\b', query_lower) for gkw in ["by", "grouped by", "for each", "per"])
    
    if is_count_query and not has_numeric_col_in_query and not has_grouping_kws:
        total_count = len(df)
        pct = (total_count / original_len) * 100 if original_len > 0 else 0.0
        
        if filters:
            f_val = filters[0]["value_str"]
            noun = "students" if "student" in query_lower else ("employees" if "employee" in query_lower else "records")
            answer = f"{f_val} {noun}: {total_count:,}\nPercentage: {pct:.1f}%"
            chart_conf = {
                "chart_type": "Pie Chart",
                "x_axis": filters[0]["column"],
                "y_axis": "count"
            }
        else:
            noun = "students" if "student" in query_lower else ("employees" if "employee" in query_lower else "records")
            answer = f"Total {noun}: {total_count:,}"
            chart_conf = None
            
        return {
            "success": True,
            "type": "statistics",
            "answer_text": answer,
            "chart_config": chart_conf
        }
    
    # 1. DATA QUALITY QUERY
    if any(k in query_lower for k in ["missing", "null", "empty", "constant", "duplicate", "clean first"]):
        dup_count = int(df.duplicated().sum())
        missing_by_col = df.isna().sum()
        missing_cols = [c for c in columns if missing_by_col[c] > 0]
        constant_cols = [c for c in columns if df[c].nunique() <= 1]
        
        if "duplicate" in query_lower:
            answer = f"There are {dup_count} exact duplicate rows in the dataset."
            if dup_count > 0:
                answer += " Removing duplicates is recommended to prevent statistical bias."
            return {"success": True, "type": "quality", "answer_text": filter_prefix + answer}
            
        if "constant" in query_lower:
            if constant_cols:
                cols_str = ", ".join([f"'{c}'" for c in constant_cols])
                answer = f"The following column(s) are constant (contain only 1 unique value): {cols_str}. They are excluded from statistics."
            else:
                answer = "No constant columns were detected. All columns contain multiple unique values."
            return {"success": True, "type": "quality", "answer_text": filter_prefix + answer}
            
        if "missing" in query_lower or "null" in query_lower:
            if missing_cols:
                lines = []
                for c in missing_cols:
                    pct = (missing_by_col[c] / len(df)) * 100
                    lines.append(f"- '{c}': {missing_by_col[c]} missing values ({pct:.2f}%)")
                answer = "Missing value summary:\n" + "\n".join(lines)
            else:
                answer = "Great news! No missing values were detected in any column of the dataset."
            return {"success": True, "type": "quality", "answer_text": filter_prefix + answer}
            
        # Default quality clean advice
        issues = []
        if dup_count > 0:
            issues.append(f"{dup_count} duplicate rows")
        for c in missing_cols:
            issues.append(f"missing values in '{c}'")
        if issues:
            answer = "Based on our scan, you should clean: " + ", ".join(issues) + "."
        else:
            answer = "The dataset looks clean and fully populated! No urgent cleaning actions are needed."
        return {"success": True, "type": "quality", "answer_text": filter_prefix + answer}

    # 2. OUTLIER QUERY
    if "outlier" in query_lower:
        target_col = matched_cols[0] if matched_cols else None
        if not target_col:
            numeric_cols = [c for c in columns if col_types.get(c) == "Numerical Measure"]
            if numeric_cols:
                target_col = numeric_cols[0]
                
        if not target_col or col_types.get(target_col) != "Numerical Measure":
            return {"success": False, "explanation": "Could not identify a Numerical Measure column to scan for outliers. Please specify a numeric column name."}
            
        series = df[target_col].dropna()
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            return {"success": True, "type": "outliers", "answer_text": filter_prefix + f"Outliers in '{target_col}' cannot be computed because the Interquartile Range (IQR) is zero."}
            
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        outliers_series = series[(series < lower_bound) | (series > upper_bound)]
        outlier_count = len(outliers_series)
        outlier_pct = (outlier_count / len(series)) * 100
        
        if "value" in query_lower or "what are" in query_lower:
            if outlier_count > 0:
                vals = outliers_series.unique()
                vals_str = ", ".join([str(v) for v in vals[:15]])
                if len(vals) > 15:
                    vals_str += ", ..."
                answer = f"The outlier values in '{target_col}' are: [{vals_str}]."
            else:
                answer = f"There are no outliers in '{target_col}'."
            return {"success": True, "type": "outliers", "answer_text": filter_prefix + answer}
            
        answer = f"Detected {outlier_count} outliers in '{target_col}' ({outlier_pct:.2f}% of non-null records) using the IQR method. Lower Bound: {lower_bound:.2f}, Upper Bound: {upper_bound:.2f}."
        return {"success": True, "type": "outliers", "answer_text": filter_prefix + answer}

    # 3. RELATIONSHIPS / CORRELATION QUERY (Prioritized)
    if any(k in query_lower for k in ["relationship", "correlation", "correlated", "associated", "related", "influence", "strongest relationship"]):
        nums = [c for c in matched_cols if col_types.get(c) == "Numerical Measure"]
        
        # If fewer than 2 numeric columns are matched, perform a ranked correlation scan
        if len(nums) < 2:
            all_nums = [c for c in columns if col_types.get(c) == "Numerical Measure"]
            if len(all_nums) < 2:
                return {"success": False, "explanation": "Correlation scans require at least 2 Numerical Measure columns in the dataset."}
            
            import math
            from scipy import stats
            
            pairs_data = []
            filter_col = nums[0] if len(nums) == 1 else None
            
            for i in range(len(all_nums)):
                for j in range(i + 1, len(all_nums)):
                    col1, col2 = all_nums[i], all_nums[j]
                    
                    if filter_col and col1 != filter_col and col2 != filter_col:
                        continue
                        
                    clean_pair = df[[col1, col2]].dropna()
                    if len(clean_pair) < 4:
                        continue
                        
                    r, p_val = stats.pearsonr(clean_pair[col1].values, clean_pair[col2].values)
                    if pd.isna(r) or r == 1.0: # Skip self-correlation or constant variance
                        continue
                        
                    # Confidence interval
                    r_clamped = max(-0.9999, min(0.9999, r))
                    z = 0.5 * math.log((1 + r_clamped) / (1 - r_clamped))
                    se = 1.0 / math.sqrt(len(clean_pair) - 3) if len(clean_pair) > 3 else 0.0
                    r_lower = math.tanh(z - 1.96 * se)
                    r_upper = math.tanh(z + 1.96 * se)
                    
                    abs_r = abs(r)
                    if abs_r >= 0.85:
                        strength = "Very Strong"
                    elif abs_r >= 0.70:
                        strength = "Strong"
                    elif abs_r >= 0.40:
                        strength = "Moderate"
                    elif abs_r >= 0.15:
                        strength = "Weak"
                    else:
                        strength = "Very Weak"
                        
                    direction = "Positive" if r >= 0 else "Negative"
                    sig_text = "statistically significant" if p_val < 0.05 else "not statistically significant"
                    
                    pairs_data.append({
                        "col1": col1,
                        "col2": col2,
                        "r": r,
                        "abs_r": abs_r,
                        "p_val": p_val,
                        "sig_text": sig_text,
                        "r_lower": r_lower,
                        "r_upper": r_upper,
                        "strength": strength,
                        "direction": direction,
                        "n_obs": len(clean_pair)
                    })
            
            if not pairs_data:
                if filter_col:
                    return {"success": True, "type": "relationship", "answer_text": filter_prefix + f"No valid numerical column pairs containing '{filter_col}' had enough data to compute correlation."}
                return {"success": True, "type": "relationship", "answer_text": filter_prefix + "No valid numerical column pairs had enough non-null records to compute correlation."}
                
            # Sort by absolute correlation coefficient descending
            pairs_data.sort(key=lambda x: x["abs_r"], reverse=True)
            top = pairs_data[0]
            
            lines = []
            if filter_col:
                lines.append(f"The strongest correlation involving '{filter_col}' is with '{top['col2'] if top['col1'] == filter_col else top['col1']}' with r = {top['r']:.4f} (P-value = {top['p_val']:.4e}, {top['sig_text']}).")
            else:
                lines.append(f"The strongest correlation is between '{top['col1']}' and '{top['col2']}' with r = {top['r']:.4f} (P-value = {top['p_val']:.4e}, {top['sig_text']}).")
                
            lines.append(f"- Strength: {top['strength']}")
            lines.append(f"- Direction: {top['direction']}")
            lines.append(f"- 95% Confidence Interval: [{top['r_lower']:.2f}, {top['r_upper']:.2f}]")
            lines.append(f"- Observations: {top['n_obs']} rows")
            lines.append(f"- Interpretation: There is a {top['strength'].lower()} {top['direction'].lower()} correlation between the two variables.")
            
            # If multiple correlations, rank top 3
            if len(pairs_data) > 1:
                lines.append("\nTop correlation rankings:")
                for rank, pair in enumerate(pairs_data[:3], 1):
                    lines.append(f"{rank}. '{pair['col1']}' vs '{pair['col2']}': r = {pair['r']:.4f} ({pair['strength']} {pair['direction']})")
                    
            answer_text = "\n".join(lines)
            return {
                "success": True,
                "type": "relationship",
                "answer_text": filter_prefix + answer_text,
                "chart_config": {
                    "chart_type": "Scatter Plot",
                    "x_axis": top["col1"],
                    "y_axis": top["col2"]
                }
            }
            
        # Specific pair correlation
        col1, col2 = nums[0], nums[1]
        
        import math
        from scipy import stats
        clean_pair = df[[col1, col2]].dropna()
        if len(clean_pair) < 4:
            return {"success": True, "type": "relationship", "answer_text": filter_prefix + f"Not enough observations between '{col1}' and '{col2}' to compute correlation."}
            
        r, p_val = stats.pearsonr(clean_pair[col1].values, clean_pair[col2].values)
        if pd.isna(r):
            return {"success": True, "type": "relationship", "answer_text": filter_prefix + f"Could not compute correlation between '{col1}' and '{col2}' due to zero variance."}
            
        abs_r = abs(r)
        if abs_r >= 0.85:
            strength = "Very Strong"
        elif abs_r >= 0.70:
            strength = "Strong"
        elif abs_r >= 0.40:
            strength = "Moderate"
        elif abs_r >= 0.15:
            strength = "Weak"
        else:
            strength = "Very Weak"
            
        direction = "Positive" if r >= 0 else "Negative"
        sig_text = "statistically significant" if p_val < 0.05 else "not statistically significant"
        
        r_clamped = max(-0.9999, min(0.9999, r))
        z = 0.5 * math.log((1 + r_clamped) / (1 - r_clamped))
        se = 1.0 / math.sqrt(len(clean_pair) - 3) if len(clean_pair) > 3 else 0.0
        r_lower = math.tanh(z - 1.96 * se)
        r_upper = math.tanh(z + 1.96 * se)
        
        answer = f"The relationship between '{col1}' and '{col2}' has a Pearson correlation coefficient of r = {r:.4f} (P-value = {p_val:.4e}, which is {sig_text}). 95% Confidence Interval: [{r_lower:.2f}, {r_upper:.2f}]. This indicates a {strength.lower()} {direction.lower()} correlation."
        return {
            "success": True,
            "type": "relationship",
            "answer_text": filter_prefix + answer,
            "chart_config": {
                "chart_type": "Scatter Plot",
                "x_axis": col1,
                "y_axis": col2
            }
        }

    # 4. DISTRIBUTION / NORMALITY QUERY
    has_dist_kws = any(k in query_lower for k in ["normally distributed", "skewed", "distribution of"])
    has_rel_kws = any(k in query_lower for k in ["relationship", "correlation", "correlated", "associated", "related", "influence", "strongest relationship"])
    
    if has_dist_kws and not has_rel_kws:
        target_col = matched_cols[0] if matched_cols else None
        if not target_col:
            numeric_cols = [c for c in columns if col_types.get(c) == "Numerical Measure"]
            if numeric_cols:
                target_col = numeric_cols[0]
                
        if not target_col:
            return {"success": False, "explanation": "Please specify a column to analyze its distribution."}
            
        chart_conf = {
            "chart_type": "Histogram",
            "x_axis": target_col,
            "y_axis": "count"
        }
        
        t = col_types.get(target_col)
        if t != "Numerical Measure":
            return {
                "success": True, 
                "type": "distribution", 
                "answer_text": filter_prefix + f"'{target_col}' is a {t} column, so we analyze it as categories instead of numeric distributions.",
                "chart_config": {
                    "chart_type": "Bar Chart",
                    "x_axis": target_col,
                    "y_axis": "count"
                }
            }
            
        from scipy import stats
        series = df[target_col].dropna()
        if len(series) < 5:
            return {
                "success": True, 
                "type": "distribution", 
                "answer_text": filter_prefix + f"Not enough data in '{target_col}' to verify distribution shape.",
                "chart_config": chart_conf
            }
            
        skew = float(stats.skew(series))
        kurt = float(stats.kurtosis(series))
        mean_val = float(series.mean())
        median_val = float(series.median())
        
        if abs(skew) < 0.25:
            skew_desc = "is approximately symmetric (normally distributed)"
        elif 0.25 <= skew < 0.75:
            skew_desc = "shows a slightly right-skewed (positively skewed) distribution"
        elif skew >= 0.75:
            skew_desc = "shows a strongly right-skewed (positively skewed) distribution"
        elif -0.75 < skew <= -0.25:
            skew_desc = "shows a slightly left-skewed (negatively skewed) distribution"
        else:
            skew_desc = "shows a strongly left-skewed (negatively skewed) distribution"
            
        answer = f"The distribution of '{target_col}' {skew_desc}.\n- Mean: {mean_val:.2f}\n- Median: {median_val:.2f}\n- Skewness: {skew:.2f}\n- Kurtosis: {kurt:.2f}"
        return {
            "success": True,
            "type": "distribution",
            "answer_text": filter_prefix + answer,
            "chart_config": {
                "chart_type": "Histogram",
                "x_axis": target_col,
                "y_axis": "count"
            }
        }

    # 5. AGGREGATIONS & CATEGORIES QUERY (Groupings)
    filtered_cols = [f["column"] for f in filters]
    cats = [c for c in matched_cols if col_types.get(c) in ["Categorical", "Date/Time", "Text"] and c not in filtered_cols]
    nums = [c for c in matched_cols if col_types.get(c) == "Numerical Measure"]
    
    # Do NOT automatically GROUP BY another column unless explicitly asked
    grouping_keywords = ["by", "grouped by", "for each", "per"]
    has_grouping_keyword = any(re.search(r'\b' + re.escape(gkw) + r'\b', query_lower) for gkw in grouping_keywords)
    has_ranking_keyword = any(k in query_lower for k in ["highest", "lowest", "top", "bottom", "most common"])
    has_comparison = query_lower.startswith("which") or "compare" in query_lower
    
    should_group = cats and (has_grouping_keyword or has_ranking_keyword or has_comparison)
    
    if should_group:
        cat_col = cats[0] if cats else None
        num_col = nums[0] if nums else None
        
        if not cat_col:
            cat_cols = [c for c in columns if col_types.get(c) in ["Categorical", "Date/Time", "Text"] and c not in filtered_cols]
            if cat_cols:
                cat_col = cat_cols[0]
        if not num_col:
            num_cols = [c for c in columns if col_types.get(c) == "Numerical Measure"]
            if num_cols:
                num_col = num_cols[0]
                
        if cat_col:
            series = df[cat_col].dropna()
            if not num_col or "count" in query_lower or "most common" in query_lower:
                top_cats = series.value_counts()
                if not top_cats.empty:
                    top_name = top_cats.index[0]
                    top_count = top_cats.iloc[0]
                    top_pct = (top_count / len(series)) * 100
                    
                    lines = [f"- '{top_name}': {top_count} records ({top_pct:.1f}%)"]
                    for name, count in list(top_cats.items())[1:5]:
                        pct = (count / len(series)) * 100
                        lines.append(f"- '{name}': {count} records ({pct:.1f}%)")
                    
                    answer = f"For column '{cat_col}', the most common category is '{top_name}' with {top_count} records ({top_pct:.1f}%).\nTop categories:\n" + "\n".join(lines)
                    return {
                        "success": True,
                        "type": "categories",
                        "answer_text": filter_prefix + answer,
                        "chart_config": {
                            "chart_type": "Bar Chart",
                            "x_axis": cat_col,
                            "y_axis": "count"
                        }
                    }
            else:
                # 1. Detect explicit aggregation requested
                agg_func = "mean"
                agg_label = "average"
                
                if "average" in query_lower or "mean" in query_lower or "avg" in query_lower:
                    agg_func = "mean"
                    agg_label = "average"
                elif "median" in query_lower:
                    agg_func = "median"
                    agg_label = "median"
                elif "sum" in query_lower or "total" in query_lower:
                    agg_func = "sum"
                    agg_label = "total"
                elif "maximum" in query_lower or "max" in query_lower:
                    agg_func = "max"
                    agg_label = "maximum"
                elif "minimum" in query_lower or "min" in query_lower:
                    agg_func = "min"
                    agg_label = "minimum"
                elif "count" in query_lower:
                    agg_func = "count"
                    agg_label = "count"
                elif "highest" in query_lower or "top" in query_lower:
                    agg_func = "max"
                    agg_label = "maximum"
                elif "lowest" in query_lower:
                    agg_func = "min"
                    agg_label = "minimum"
                    
                # 2. Detect explicit sorting order requested
                sort_ascending = False
                if "lowest" in query_lower or "bottom" in query_lower or "worst" in query_lower or "least" in query_lower:
                    sort_ascending = True
                    
                grouped = df.groupby(cat_col)[num_col].agg(agg_func).sort_values(ascending=sort_ascending).dropna()
                if not grouped.empty:
                    top_name = grouped.index[0]
                    top_val = grouped.iloc[0]
                    
                    lines = []
                    for name, val in list(grouped.items())[:5]:
                        lines.append(f"- '{name}': {val:.2f}")
                    
                    answer = f"The {agg_label} '{num_col}' by '{cat_col}' (Top category is '{top_name}' with a value of {top_val:.2f}):\n" + "\n".join(lines)
                    return {
                        "success": True,
                        "type": "aggregation",
                        "answer_text": filter_prefix + answer,
                        "chart_config": {
                            "chart_type": "Bar Chart",
                            "x_axis": cat_col,
                            "y_axis": num_col
                        }
                    }

    # 6. BASIC STATISTICS QUERY
    if any(k in query_lower for k in ["average", "mean", "maximum", "max", "minimum", "min", "median", "standard deviation", "std dev", "stddev", "highest", "lowest", "top", "bottom"]):
        target_col = matched_cols[0] if matched_cols else None
        if not target_col:
            numeric_cols = [c for c in columns if col_types.get(c) == "Numerical Measure"]
            if numeric_cols:
                target_col = numeric_cols[0]
                
        if target_col and col_types.get(target_col) == "Numerical Measure":
            series = df[target_col].dropna()
            if not series.empty:
                if "average" in query_lower or "mean" in query_lower or "avg" in query_lower:
                    val = float(series.mean())
                    answer = f"The average (mean) value of '{target_col}' is {val:.2f}."
                elif "median" in query_lower:
                    val = float(series.median())
                    answer = f"The median value of '{target_col}' is {val:.2f}."
                elif "maximum" in query_lower or "max" in query_lower or "highest" in query_lower or "top" in query_lower:
                    val = float(series.max())
                    answer = f"The maximum value of '{target_col}' is {val:.2f}."
                elif "minimum" in query_lower or "min" in query_lower or "lowest" in query_lower or "bottom" in query_lower:
                    val = float(series.min())
                    answer = f"The minimum value of '{target_col}' is {val:.2f}."
                else:
                    val = float(series.std())
                    answer = f"The standard deviation of '{target_col}' is {val:.2f}."
                    
                return {"success": True, "type": "statistics", "answer_text": filter_prefix + answer}

    # 7. CHART VISUALIZATION & RECOMMENDATION
    if any(k in query_lower for k in ["chart", "plot", "graph", "recommend"]):
        matched_types = [col_types.get(col, "Text") for col in matched_cols]
        chart_type = detect_chart_type_intent(query, matched_types)
        x_axis = matched_cols[0] if matched_cols else None
        y_axis = matched_cols[1] if len(matched_cols) > 1 else ("count" if chart_type != "Histogram" else None)
        
        if not x_axis:
            cols_keys = list(col_types.keys())
            if cols_keys:
                x_axis = cols_keys[0]
                y_axis = "count"
                
        answer = f"I recommend using a **{chart_type}** to visualize this data."
        if x_axis:
            answer += f" Setting X-Axis = '{x_axis}'"
        if y_axis:
            answer += f" and Y-Axis = '{y_axis}'."
            
        return {
            "success": True,
            "type": "visualization",
            "answer_text": filter_prefix + answer,
            "chart_config": {
                "chart_type": chart_type,
                "x_axis": x_axis,
                "y_axis": y_axis
            }
        }

    # FALLBACK (original behavior)
    matched_types = [col_types.get(col, "Text") for col in matched_cols]
    chart_type = detect_chart_type_intent(query, matched_types)
    x_axis = matched_cols[0] if matched_cols else None
    y_axis = matched_cols[1] if len(matched_cols) > 1 else ("count" if chart_type != "Histogram" else None)
    
    if not matched_cols:
        return {
            "success": False,
            "explanation": "Could not identify any column names from your query. Try using exact column names (like 'Final Score', 'Department', etc.) or asking about statistics like average, max, or outliers."
        }
        
    col_desc = ", ".join([f"'{c}'" for c in matched_cols])
    answer = f"Detected columns: {col_desc}. Configured a **{chart_type}** mapped with X-Axis = '{x_axis}' and Y-Axis = '{y_axis}'."
    return {
        "success": True,
        "type": "visualization",
        "answer_text": filter_prefix + answer,
        "chart_config": {
            "chart_type": chart_type,
            "x_axis": x_axis,
            "y_axis": y_axis
        }
    }
