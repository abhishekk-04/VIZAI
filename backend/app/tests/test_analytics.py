import unittest
import pandas as pd
import numpy as np

from app.services.data_detector import detect_column_types, get_dataset_stats
from app.services.cleaner import apply_cleaning_operation, replay_cleaning_history
from app.services.nlq_parser import parse_natural_language_query, match_columns_in_query

class TestVizAIAnalytics(unittest.TestCase):
    
    def setUp(self):
        # Sample dataset for analytics tests
        self.df = pd.DataFrame({
            "Name": ["Alice", "Bob", "Charlie", "David", "Alice"],
            "Age": [25, 30, 35, np.nan, 25],
            "Salary": [50000.0, 60000.0, 75000.0, 80000.0, 50000.0],
            "Dept": ["HR", "Engineering", "Marketing", "Engineering", "HR"],
            "Joined": ["2023-01-15", "2022-06-20", "2021-11-05", "2020-03-12", "2023-01-15"],
            "Active": [True, False, True, True, True]
        })

    def test_data_type_detection(self):
        col_types = detect_column_types(self.df)
        
        self.assertEqual(col_types["Age"], "Numerical Measure")
        self.assertEqual(col_types["Salary"], "Numerical Measure")
        self.assertEqual(col_types["Active"], "Boolean")
        self.assertEqual(col_types["Dept"], "Categorical")
        self.assertEqual(col_types["Joined"], "Date/Time")
        self.assertEqual(col_types["Name"], "Categorical")

    def test_dataset_stats(self):
        col_types = detect_column_types(self.df)
        stats = get_dataset_stats(self.df, col_types)
        
        self.assertEqual(stats["rows"], 5)
        self.assertEqual(stats["columns"], 6)
        self.assertEqual(stats["missing_values"], 1)
        self.assertEqual(stats["duplicate_rows"], 1)
        self.assertEqual(stats["numerical_columns_count"], 2)

    def test_cleaning_operations(self):
        cleaned = apply_cleaning_operation(self.df, "remove_duplicates", {})
        self.assertEqual(len(cleaned), 4)
        
        cleaned = apply_cleaning_operation(self.df, "drop_column", {"column": "Joined"})
        self.assertNotIn("Joined", cleaned.columns)
        
        cleaned = apply_cleaning_operation(self.df, "rename_column", {"column": "Dept", "new_name": "Department"})
        self.assertIn("Department", cleaned.columns)
        self.assertNotIn("Dept", cleaned.columns)
        
        cleaned = apply_cleaning_operation(self.df, "delete_nulls", {"column": "Age"})
        self.assertEqual(len(cleaned), 4)
        
        cleaned = apply_cleaning_operation(self.df, "fill_missing", {"column": "Age", "method": "median"})
        self.assertFalse(cleaned["Age"].isna().any())
        self.assertEqual(cleaned["Age"].iloc[3], 27.5)

    def test_cleaning_history_replay(self):
        history = [
            {"action": "remove_duplicates", "params": {}},
            {"action": "drop_column", "params": {"column": "Name"}}
        ]
        cleaned = replay_cleaning_history(self.df, history)
        self.assertEqual(len(cleaned), 4)
        self.assertNotIn("Name", cleaned.columns)

    def test_nlq_query_parser(self):
        col_types = detect_column_types(self.df)
        
        # Test basic visualization query mapping
        res = parse_natural_language_query("Compare Dept salaries", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["chart_config"]["chart_type"], "Bar Chart")
        self.assertEqual(res["chart_config"]["x_axis"], "Dept")
        self.assertEqual(res["chart_config"]["y_axis"], "Salary")
        
        # Test distribution query mapping
        res = parse_natural_language_query("Show distribution of Age", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["chart_config"]["chart_type"], "Histogram")
        self.assertEqual(res["chart_config"]["x_axis"], "Age")
        self.assertEqual(res["type"], "distribution")

        # Test data quality query
        res = parse_natural_language_query("Are there duplicate rows?", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["type"], "quality")
        self.assertIn("1 exact duplicate rows", res["answer_text"])

        # Test statistics Q&A calculation
        res = parse_natural_language_query("What is the average Salary?", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["type"], "statistics")
        self.assertIn("63000.00", res["answer_text"])

        # Test general correlation ranking query
        res = parse_natural_language_query("Which two columns have the strongest correlation?", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["type"], "relationship")
        self.assertIn("strongest correlation", res["answer_text"])
        self.assertEqual(res["chart_config"]["chart_type"], "Scatter Plot")
        self.assertEqual(res["chart_config"]["x_axis"], "Age")
        self.assertEqual(res["chart_config"]["y_axis"], "Salary")

        # Test explicit aggregation vs sorting prioritizations
        res = parse_natural_language_query("Which Dept has the highest average Salary?", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["type"], "aggregation")
        self.assertIn("average 'Salary' by 'Dept'", res["answer_text"])
        self.assertIn("Marketing': 75000.00", res["answer_text"]) # Highest average

        res = parse_natural_language_query("Which Dept has the lowest average Salary?", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["type"], "aggregation")
        self.assertIn("average 'Salary' by 'Dept'", res["answer_text"])
        self.assertIn("HR': 50000.00", res["answer_text"]) # Lowest average

        res = parse_natural_language_query("Which Dept has the highest maximum Salary?", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["type"], "aggregation")
        self.assertIn("maximum 'Salary' by 'Dept'", res["answer_text"])
        self.assertIn("Engineering': 80000.00", res["answer_text"]) # Highest maximum

        # Test filter vs grouping separation
        res = parse_natural_language_query("Average Salary for Dept = HR", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["type"], "statistics")
        self.assertIn("Filtered by 'Dept' = 'HR'", res["answer_text"])
        self.assertIn("50000.00", res["answer_text"]) # average Salary of HR is 50000

        res = parse_natural_language_query("Average Salary for Engineering", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["type"], "statistics")
        self.assertIn("Filtered by 'Dept' = 'Engineering'", res["answer_text"])
        self.assertIn("70000.00", res["answer_text"]) # average Salary of Engineering is 70000

        res = parse_natural_language_query("Average Salary by Name for HR", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["type"], "aggregation")
        self.assertIn("Filtered by 'Dept' = 'HR'", res["answer_text"])
        self.assertIn("average 'Salary' by 'Name'", res["answer_text"])

        # Test priority column matching (longest complete match priority)
        matched = match_columns_in_query("What is the average Exam Score?", ["Exam Date", "Exam Score"])
        self.assertEqual(matched, ["Exam Score"])

        # Test normalized categorical filter value extraction
        df_cs = pd.DataFrame({
            "Dept": ["computer_science_and_engineering", "HR", "computer_science_and_engineering"],
            "Salary": [80000.0, 50000.0, 90000.0]
        })
        col_types_cs = {"Dept": "Categorical", "Salary": "Numerical Measure"}
        res = parse_natural_language_query(
            "What is the average Salary for Computer Science and Engineering students?",
            df_cs,
            col_types_cs
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["type"], "statistics")
        self.assertIn("Filtered by 'Dept' = 'computer_science_and_engineering'", res["answer_text"])
        self.assertIn("85000.00", res["answer_text"]) # (80000+90000)/2 = 85000

        # Test direct count formatting (How many Present students...)
        res = parse_natural_language_query("How many HR employees are there?", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["type"], "statistics")
        self.assertEqual(res["answer_text"], "HR employees: 2\nPercentage: 40.0%")
        self.assertEqual(res["chart_config"]["chart_type"], "Pie Chart")
        self.assertEqual(res["chart_config"]["x_axis"], "Dept")

        # Test relationship priority (no Histograms for relationship/correlation questions)
        res = parse_natural_language_query("Is there a relationship between Age and Salary?", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["chart_config"]["chart_type"], "Scatter Plot")
        self.assertEqual(res["type"], "relationship")

        # Test single variable relationship scan
        res = parse_natural_language_query("Which variable is most strongly related to Age?", self.df, col_types)
        self.assertTrue(res["success"])
        self.assertEqual(res["type"], "relationship")
        self.assertIn("Age", res["answer_text"])
        self.assertIn("Salary", res["answer_text"]) # Salary correlates with Age
        self.assertEqual(res["chart_config"]["chart_type"], "Scatter Plot")

    def test_id_classification_and_exclusion(self):
        df_with_ids = pd.DataFrame({
            "CustomerID": [101, 102, 103, 104, 105],
            "serial_number": ["SN1", "SN2", "SN3", "SN4", "SN5"],
            "highly_unique_int": [999, 888, 777, 666, 555],
            "Age": [20, 30, 40, 50, 60],
            "ConstantCol": [5, 5, 5, 5, 5]
        })
        col_types = detect_column_types(df_with_ids)
        
        self.assertEqual(col_types["CustomerID"], "Identifier (ID)")
        self.assertEqual(col_types["serial_number"], "Identifier (ID)")
        self.assertEqual(col_types["highly_unique_int"], "Identifier (ID)")
        self.assertEqual(col_types["Age"], "Numerical Measure")
        self.assertNotEqual(col_types["ConstantCol"], "Identifier (ID)")

    def test_sequential_integers_id_heuristic(self):
        df_seq = pd.DataFrame({
            "seq_col": [1, 2, 3, 4, 5, 6, 7],
            "Age": [34, 45, 23, 12, 54, 32, 21]
        })
        col_types = detect_column_types(df_seq)
        # seq_col represents sequential integers, so it should be Identifier
        self.assertEqual(col_types["seq_col"], "Identifier (ID)")

    def test_advanced_statistical_insights(self):
        from app.services.insight_generator import generate_dataset_insights
        
        df = pd.DataFrame({
            "CustomerID": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
            "Income": [50, 55, 52, 53, 54, 51, 56, 52, 53, 58, 200, 220, 51, 52, 50],
            "Spending": [10, 11, 10, 12, 11, 9, 12, 11, 10, 13, 80, 85, 10, 11, 9],
            "ConstantCol": [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
        })
        
        col_types = {
            "CustomerID": "Identifier (ID)",
            "Income": "Numerical Measure",
            "Spending": "Numerical Measure",
            "ConstantCol": "Numerical Measure"
        }
        
        insights = generate_dataset_insights(df, col_types)
        
        id_insights = [inst for inst in insights if "CustomerID" in inst["title"]]
        self.assertEqual(len(id_insights), 0)
        
        outlier_insights = [inst for inst in insights if inst["type"] == "outlier" and "Income" in inst["title"]]
        self.assertTrue(len(outlier_insights) > 0)
        self.assertIn("Lower Bound", outlier_insights[0]["message"])
        self.assertIn("Upper Bound", outlier_insights[0]["message"])
        self.assertIn("Method: IQR", outlier_insights[0]["message"])
        self.assertIn("Interpretation: These observations are unusual but may still be valid.", outlier_insights[0]["message"])
        
        corr_insights = [inst for inst in insights if inst["type"] == "correlation"]
        self.assertTrue(len(corr_insights) > 0)
        for inst in corr_insights:
            self.assertNotIn("CustomerID", inst["title"])
            self.assertNotIn("ConstantCol", inst["title"])
            self.assertIn("Income", inst["title"])
            self.assertIn("Spending", inst["title"])
            # Ensure p-value and confidence interval are present
            self.assertIn("P-value", inst["message"])
            self.assertIn("95% Confidence Interval", inst["message"])
            
        quality_insights = [inst for inst in insights if inst["type"] == "quality" and "ConstantCol" in inst["title"]]
        self.assertTrue(len(quality_insights) > 0)

    def test_manual_type_conversion_override(self):
        from app.routes.datasets import apply_type_overrides_from_history
        col_types = {
            "Age": "Numerical Measure",
            "Gender": "Categorical",
            "CustomerID": "Identifier (ID)"
        }
        history = [
            {"action": "convert_type", "params": {"column": "Age", "to_type": "Categorical"}},
            {"action": "convert_type", "params": {"column": "Gender", "to_type": "Numerical"}}
        ]
        overridden = apply_type_overrides_from_history(col_types, history)
        self.assertEqual(overridden["Age"], "Categorical")
        self.assertEqual(overridden["Gender"], "Numerical Measure")
        self.assertEqual(overridden["CustomerID"], "Identifier (ID)")

if __name__ == '__main__':
    unittest.main()
