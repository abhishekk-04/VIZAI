import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Label,
  ReferenceArea,
  Brush
} from 'recharts';
import { 
  BarChart3, 
  Sparkles, 
  Send, 
  Download, 
  Database,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  Info,
  Maximize2,
  CheckCircle,
  FileDown,
  Grid
} from 'lucide-react';

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const VizStudio = () => {
  const [activeDataset, setActiveDataset] = useState(null);
  const [fullData, setFullData] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Chart Config State
  const [selectedChart, setSelectedChart] = useState('Bar Chart');
  const [xAxisCol, setXAxisCol] = useState('');
  const [yAxisCol, setYAxisCol] = useState('');
  
  // Label and Title State
  const [chartTitle, setChartTitle] = useState('');
  const [xAxisLabel, setXAxisLabel] = useState('');
  const [yAxisLabel, setYAxisLabel] = useState('');
  const [histogramData, setHistogramData] = useState([]);
  const [correlationMatrix, setCorrelationMatrix] = useState({ columns: [], matrix: [] });
  
  // NLQ Chat State
  const [chatQuery, setChatQuery] = useState('');
  const [nlqExplanation, setNlqExplanation] = useState('');
  const [nlqSuccess, setNlqSuccess] = useState(null);

  // Advanced Controls State
  const [rowLimit, setRowLimit] = useState(null); // null represents "All Rows"
  const [sampleMethod, setSampleMethod] = useState('first'); // 'first' or 'random'
  
  // X-Axis & Y-Axis Range Controls
  const [xMin, setXMin] = useState('');
  const [xMax, setXMax] = useState('');
  const [xAutoScale, setXAutoScale] = useState(true);
  
  const [yMin, setYMin] = useState('');
  const [yMax, setYMax] = useState('');
  const [yAutoScale, setYAutoScale] = useState(true);

  // Zoom & Pan custom domains
  const [zoomXDomain, setZoomXDomain] = useState(null);
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);

  const chartRef = useRef(null);
  const navigate = useNavigate();

  const loadDatasetDetail = async () => {
    const datasetId = localStorage.getItem('activeDatasetId');
    if (!datasetId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const detail = await api.get(`/datasets/${datasetId}`);
      setActiveDataset(detail);
      
      const cols = Object.keys(detail.columns_metadata || {});
      if (cols.length > 0) {
        const categorical = cols.find(c => detail.columns_metadata[c] === 'Categorical' || detail.columns_metadata[c] === 'Date/Time');
        const numerical = cols.find(c => detail.columns_metadata[c] === 'Numerical Measure');
        
        const defaultX = categorical || cols[0];
        const defaultY = numerical || (cols[1] || 'count');
        setXAxisCol(defaultX);
        setYAxisCol(defaultY);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to initialize studio workspace.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubsetData = async () => {
    const datasetId = localStorage.getItem('activeDatasetId');
    if (!datasetId || !activeDataset) return;
    try {
      setLoading(true);
      const limitParam = rowLimit ? `&row_limit=${rowLimit}` : '';
      const sampleParam = `&sample_method=${sampleMethod}`;
      
      const pageSize = rowLimit || 10000;
      const res = await api.get(`/datasets/${datasetId}/preview?page=1&page_size=${pageSize}${limitParam}${sampleParam}`);
      setFullData(res.data);
      
      const insightRes = await api.get(`/datasets/${datasetId}/insights?${limitParam}${sampleParam}`);
      setInsights(insightRes.insights);
      
      setZoomXDomain(null);
    } catch (err) {
      console.error('Failed to load subset data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatasetDetail();
  }, []);

  useEffect(() => {
    if (activeDataset) {
      fetchSubsetData();
    }
  }, [activeDataset, rowLimit, sampleMethod]);

  // Fetch Freedman-Diaconis histogram from backend
  const fetchHistogramData = async () => {
    if (!activeDataset || selectedChart !== 'Histogram' || !xAxisCol) return;
    const xType = activeDataset.columns_metadata[xAxisCol];
    if (xType !== 'Numerical Measure') {
      setHistogramData([]);
      return;
    }
    try {
      const limitParam = rowLimit ? `&row_limit=${rowLimit}` : '';
      const sampleParam = `&sample_method=${sampleMethod}`;
      const res = await api.get(`/datasets/${activeDataset.id}/histogram?column=${encodeURIComponent(xAxisCol)}${limitParam}${sampleParam}`);
      setHistogramData(res.bins.map(b => ({
        name: b.bin_range,
        count: b.count
      })));
    } catch (err) {
      console.error('Failed to load histogram:', err);
      setHistogramData([]);
    }
  };

  // Fetch Correlation Matrix from backend
  const fetchCorrelationMatrix = async () => {
    if (!activeDataset || selectedChart !== 'Correlation Heatmap') return;
    try {
      const limitParam = rowLimit ? `&row_limit=${rowLimit}` : '';
      const sampleParam = `&sample_method=${sampleMethod}`;
      const res = await api.get(`/datasets/${activeDataset.id}/correlation-matrix?${limitParam}${sampleParam}`);
      setCorrelationMatrix(res);
    } catch (err) {
      console.error('Failed to load correlation matrix:', err);
      setCorrelationMatrix({ columns: [], matrix: [] });
    }
  };

  useEffect(() => {
    if (selectedChart === 'Histogram' && xAxisCol && activeDataset) {
      fetchHistogramData();
    }
  }, [selectedChart, xAxisCol, activeDataset, rowLimit, sampleMethod]);

  useEffect(() => {
    if (selectedChart === 'Correlation Heatmap' && activeDataset) {
      fetchCorrelationMatrix();
    }
  }, [selectedChart, activeDataset, rowLimit, sampleMethod]);

  // Synchronize labels and titles
  useEffect(() => {
    if (activeDataset && xAxisCol && yAxisCol) {
      const xType = activeDataset.columns_metadata[xAxisCol];
      const yType = activeDataset.columns_metadata[yAxisCol];
      
      const isXCat = xType?.toLowerCase() === 'categorical';
      const isYNum = yType?.toLowerCase() === 'numerical measure';
      
      if (selectedChart === 'Histogram') {
        setChartTitle(`Distribution of ${xAxisCol}`);
        setYAxisLabel('Frequency');
      } else if (isXCat && isYNum && yAxisCol !== 'count') {
        setChartTitle(`Average ${yAxisCol} by ${xAxisCol}`);
        setYAxisLabel(`Average ${yAxisCol}`);
      } else if (yAxisCol === 'count') {
        setChartTitle(`Record Count by ${xAxisCol}`);
        setYAxisLabel('Record Count');
      } else {
        setChartTitle(`${selectedChart}: ${xAxisCol} vs ${yAxisCol}`);
        setYAxisLabel(yAxisCol);
      }
      setXAxisLabel(xAxisCol);
    }
  }, [selectedChart, xAxisCol, yAxisCol, activeDataset]);

  // NLQ Submit
  const handleNLQSubmit = async (e) => {
    e.preventDefault();
    if (!chatQuery.trim() || !activeDataset) return;
    try {
      const res = await api.post(`/datasets/${activeDataset.id}/query`, { 
        query: chatQuery,
        row_limit: rowLimit,
        sample_method: sampleMethod
      });
      setNlqSuccess(res.success);
      setNlqExplanation(res.answer_text || res.explanation);
      
      if (res.success) {
        if (res.chart_config) {
          if (res.chart_config.chart_type) setSelectedChart(res.chart_config.chart_type);
          if (res.chart_config.x_axis) setXAxisCol(res.chart_config.x_axis);
          if (res.chart_config.y_axis) setYAxisCol(res.chart_config.y_axis);
        } else if (res.chart_type) {
          setSelectedChart(res.chart_type);
          if (res.x_axis) setXAxisCol(res.x_axis);
          if (res.y_axis) setYAxisCol(res.y_axis);
        }
      }
      setChatQuery('');
    } catch (err) {
      console.error(err);
      setNlqSuccess(false);
      setNlqExplanation('Failed to parse your query. Try rephrasing with column names.');
    }
  };

  // Smart Chart Recommendation (BI-Grade rules based on semantic data models)
  const getRecommendation = () => {
    if (!activeDataset || !xAxisCol) return null;
    
    const xType = activeDataset.columns_metadata[xAxisCol];
    const yType = yAxisCol ? activeDataset.columns_metadata[yAxisCol] : null;
    const isYCount = yAxisCol === 'count';
    
    if (xType === 'Identifier (ID)' || (yAxisCol !== 'count' && yType === 'Identifier (ID)')) {
      return {
        charts: [],
        text: `${xType === 'Identifier (ID)' ? xAxisCol : yAxisCol} is an Identifier. Choose another column.`
      };
    }
    
    // Single Numerical Measure
    if (xType === 'Numerical Measure' && (isYCount || selectedChart === 'Histogram')) {
      return {
        charts: ['Histogram', 'Density Plot', 'Box Plot'],
        text: `Since '${xAxisCol}' is a Numerical Measure, visualize its distribution using a Histogram, Density Plot, or Box Plot.`
      };
    }
    
    // Two Numerical Measures
    if (xType === 'Numerical Measure' && yType === 'Numerical Measure') {
      return {
        charts: ['Scatter Plot', 'Regression Plot', 'Hexbin Plot'],
        text: `Since both '${xAxisCol}' and '${yAxisCol}' are Numerical Measures, analyze their relationship with a Scatter Plot, Regression Plot, or Hexbin Plot.`
      };
    }
    
    // Categorical
    if (xType === 'Categorical' && isYCount) {
      return {
        charts: ['Bar Chart', 'Pie Chart', 'Donut Chart'],
        text: `Since '${xAxisCol}' is Categorical, compare category frequencies using a Bar Chart, Pie Chart, or Donut Chart.`
      };
    }
    
    // Numerical + Categorical
    if ((xType === 'Categorical' && yType === 'Numerical Measure') || (xType === 'Numerical Measure' && yType === 'Categorical')) {
      return {
        charts: ['Box Plot', 'Violin Plot', 'Bar Chart', 'Strip Plot'],
        text: `Since you are mapping a Categorical dimension against a Numerical Measure, compare distributions using a Box Plot, Violin Plot, Bar Chart, or Strip Plot.`
      };
    }
    
    // Date + Numerical
    if (xType === 'Date/Time' && yType === 'Numerical Measure') {
      return {
        charts: ['Line Chart', 'Area Chart'],
        text: `Since X is Date/Time and Y is a Numerical Measure, trace continuous changes over time using a Line Chart or Area Chart.`
      };
    }
    
    return {
      charts: ['Bar Chart'],
      text: 'Recommended: Customize your axis mappings to match dimensions and measures.'
    };
  };

  // Chart Validation Pipeline (BI-Grade rules)
  const validateChartSelection = () => {
    if (!activeDataset || !xAxisCol) return { valid: true };
    
    const xType = activeDataset.columns_metadata[xAxisCol];
    const yType = yAxisCol ? activeDataset.columns_metadata[yAxisCol] : null;
    
    // 1. Identifier Exclusions
    if (xType === 'Identifier (ID)') {
      return {
        valid: false,
        reason: `${xAxisCol} is an Identifier column.`,
        message: `${xAxisCol} has been detected as an Identifier column. Identifier columns are excluded from statistical analysis because they do not represent measurable variables.`,
        fix: 'Please select a different numerical feature or categorical dimension for the X-Axis.'
      };
    }
    if (selectedChart !== 'Histogram' && selectedChart !== 'Correlation Heatmap' && yAxisCol !== 'count' && yType === 'Identifier (ID)') {
      return {
        valid: false,
        reason: `${yAxisCol} is an Identifier column.`,
        message: `${yAxisCol} has been detected as an Identifier column. Identifier columns are excluded from statistical analysis because they do not represent measurable variables.`,
        fix: 'Please select a different numerical feature for the Y-Axis.'
      };
    }
    
    // 2. Histogram Rules
    if (selectedChart === 'Histogram') {
      if (xType !== 'Numerical Measure') {
        return {
          valid: false,
          reason: `Histogram requires Numerical Measure only.`,
          message: `Never allow Identifier, Boolean, Date, or Text columns for Histograms.`,
          fix: 'Please select a Numerical Measure column for the X-Axis.'
        };
      }
    }
    
    // 3. Scatter Plot Rules
    if (selectedChart === 'Scatter Plot') {
      if (xType !== 'Numerical Measure' || yType !== 'Numerical Measure') {
        return {
          valid: false,
          reason: 'X and Y must be Numerical Measures.',
          message: `Scatter Plot unavailable. Both axes must be Numerical Measures.`,
          fix: 'Please set both X-Axis and Y-Axis to genuine Numerical Measure variables.'
        };
      }
    }
    
    // 4. Bar, Line, Area Rules
    if (selectedChart === 'Bar Chart' || selectedChart === 'Line Chart' || selectedChart === 'Area Chart') {
      if (yAxisCol !== 'count' && yType !== 'Numerical Measure') {
        return {
          valid: false,
          reason: `${selectedChart} requires a Numerical Measure Y-axis (or 'Record Count').`,
          message: `${selectedChart} is invalid for non-numerical measurements.`,
          fix: 'Please set Y-Axis to a Numerical Measure variable or choose Record Count.'
        };
      }
    }
    
    // 5. Pie, Donut, Radar Rules
    if (selectedChart === 'Pie Chart' || selectedChart === 'Donut Chart' || selectedChart === 'Radar Chart') {
      if (yAxisCol !== 'count' && yType !== 'Numerical Measure') {
        return {
          valid: false,
          reason: `${selectedChart} requires a Numerical Measure Y-axis.`,
          message: `${selectedChart} sizes can only be scaled to Numerical Measures.`,
          fix: 'Please select a Numerical Measure variable for the Y-Axis.'
        };
      }
    }
    
    return { valid: true };
  };

  // Helper to calculate category averages and build dynamic comparison insights
  const getCategoryComparisonInsight = () => {
    if (!activeDataset || !xAxisCol || !yAxisCol || yAxisCol === 'count' || fullData.length === 0) return null;
    const xType = activeDataset.columns_metadata[xAxisCol];
    const yType = activeDataset.columns_metadata[yAxisCol];
    
    if (xType?.toLowerCase() === 'categorical' && yType?.toLowerCase() === 'numerical measure') {
      const groups = {};
      fullData.forEach(item => {
        const key = item[xAxisCol];
        if (key !== null && key !== undefined) {
          const keyStr = key.toString();
          if (!groups[keyStr]) {
            groups[keyStr] = { sum: 0, count: 0 };
          }
          const val = parseFloat(item[yAxisCol]);
          if (!isNaN(val)) {
            groups[keyStr].sum += val;
            groups[keyStr].count++;
          }
        }
      });
      
      const averages = Object.entries(groups)
        .map(([name, g]) => ({ name, avg: g.sum / (g.count || 1) }))
        .filter(g => !isNaN(g.avg))
        .sort((a, b) => b.avg - a.avg);
        
      if (averages.length >= 2) {
        const top = averages[0];
        const bottom = averages[averages.length - 1];
        const diff = top.avg - bottom.avg;
        
        if (diff < 0.08 * bottom.avg) {
          return {
            title: `Category Comparison: ${xAxisCol}`,
            message: `The average ${yAxisCol} is very similar between ${bottom.name} and ${top.name} customers, with only a small difference in the mean values.`
          };
        } else {
          return {
            title: `Category Comparison: ${xAxisCol}`,
            message: `Average ${yAxisCol} is slightly higher for ${top.name} customers than ${bottom.name} customers. Difference: ${diff.toFixed(1)} ${yAxisCol.includes('k$') ? 'k$' : ''}. This difference is descriptive and based on category averages.`
          };
        }
      }
    }
    return null;
  };

  const getXDomain = () => {
    if (zoomXDomain) return zoomXDomain;
    const xType = activeDataset?.columns_metadata?.[xAxisCol];
    if (xType === 'Numerical Measure' && !xAutoScale) {
      const min = parseFloat(xMin);
      const max = parseFloat(xMax);
      if (!isNaN(min) && !isNaN(max) && min < max) {
        return [min, max];
      }
    }
    return ['auto', 'auto'];
  };

  const getYDomain = () => {
    const yType = activeDataset?.columns_metadata?.[yAxisCol];
    const isYNumeric = yAxisCol === 'count' || yType === 'Numerical Measure';
    if (isYNumeric && !yAutoScale) {
      const min = parseFloat(yMin);
      const max = parseFloat(yMax);
      if (!isNaN(min) && !isNaN(max) && min < max) {
        return [min, max];
      }
    }
    return ['auto', 'auto'];
  };

  const handleZoom = () => {
    if (refAreaLeft === refAreaRight || !refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    let left = refAreaLeft;
    let right = refAreaRight;
    
    const isXNumeric = activeDataset?.columns_metadata?.[xAxisCol] === 'Numerical Measure';
    if (isXNumeric) {
      let numLeft = parseFloat(left);
      let numRight = parseFloat(right);
      if (!isNaN(numLeft) && !isNaN(numRight)) {
        if (numLeft > numRight) {
          const tmp = numLeft;
          numLeft = numRight;
          numRight = tmp;
        }
        setZoomXDomain([numLeft, numRight]);
      }
    } else {
      setZoomXDomain([left, right]);
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  // Helper to compile data for rendering
  const getChartData = () => {
    if (fullData.length === 0 || !xAxisCol || !yAxisCol) return [];
    
    // Case 1: Histogram local bin aggregation (loaded from backend)
    if (selectedChart === 'Histogram') {
      return histogramData;
    }
    
    // Case 2: Aggregate values by X-axis (Grouping)
    const xType = activeDataset?.columns_metadata[xAxisCol];
    if (yAxisCol === 'count' || xType === 'Categorical') {
      const groups = {};
      fullData.forEach(item => {
        const key = item[xAxisCol] !== null && item[xAxisCol] !== undefined ? item[xAxisCol].toString() : 'null';
        if (!groups[key]) {
          groups[key] = { name: key, count: 0, sum: 0, records: 0 };
        }
        groups[key].records++;
        if (yAxisCol !== 'count') {
          const val = parseFloat(item[yAxisCol]);
          if (!isNaN(val)) groups[key].sum += val;
        }
      });
      
      return Object.values(groups).map(g => ({
        name: g.name,
        [yAxisCol]: yAxisCol === 'count' ? g.records : parseFloat((g.sum / (g.records || 1)).toFixed(2))
      })).slice(0, 15);
    }
    
    // Case 3: Straight rendering (Time series or Scatters)
    const yType = yAxisCol ? activeDataset?.columns_metadata[yAxisCol] : null;
    return fullData.map(item => {
      const xVal = item[xAxisCol];
      const yVal = item[yAxisCol];
      const xParsed = xType === 'Numerical Measure' ? parseFloat(xVal) : xVal;
      const yParsed = yType === 'Numerical Measure' ? parseFloat(yVal) : yVal;
      return {
        name: xVal !== null && xVal !== undefined ? xVal.toString() : '',
        [xAxisCol]: isNaN(xParsed) ? 0 : xParsed,
        [yAxisCol]: isNaN(yParsed) ? 0 : yParsed
      };
    }).slice(0, 50);
  };

  // Export visual logic
  const handleExport = (format) => {
    if (format === 'png') {
      window.print();
    } else {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        chart_type: selectedChart,
        x_axis: xAxisCol,
        y_axis: yAxisCol,
        chart_title: chartTitle,
        x_axis_label: xAxisLabel,
        y_axis_label: yAxisLabel,
        dataset_name: activeDataset.name
      }, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `vizai_chart_${activeDataset.id}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
  };

  const validation = validateChartSelection();
  const recommendation = getRecommendation();
  const chartData = getChartData();

  const isXNumeric = activeDataset?.columns_metadata?.[xAxisCol] === 'Numerical Measure';
  const isYNumeric = yAxisCol === 'count' || activeDataset?.columns_metadata?.[yAxisCol] === 'Numerical Measure';
  
  const xRangeWarning = !xAutoScale && xMin && xMax && (parseFloat(xMin) >= parseFloat(xMax) || isNaN(parseFloat(xMin)) || isNaN(parseFloat(xMax)))
    ? "Min must be less than Max"
    : null;
  const yRangeWarning = !yAutoScale && yMin && yMax && (parseFloat(yMin) >= parseFloat(yMax) || isNaN(parseFloat(yMin)) || isNaN(parseFloat(yMax)))
    ? "Min must be less than Max"
    : null;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Visualization Studio</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Configure charts and leverage automated analytics insights</p>
        </div>
      </div>

      {!activeDataset ? (
        <div className="glass-panel" style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center' }}>
          <Database size={48} style={{ color: 'var(--text-muted)' }} />
          <h3>Select a Dataset</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '300px' }}>
            Please select or upload a dataset file in the Dataset Workspace before plotting charts.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/upload')}>
            <span>Go to Upload</span>
          </button>
        </div>
      ) : (
        <div className="split-workspace">
          {/* Left panel: configure columns + recommendations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Dataset Summary Stats Widget */}
            <div className="glass-panel" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <Database size={16} style={{ color: 'var(--primary)' }} />
                <span>Dataset Profile Summary</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '0.8rem' }}>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Rows</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '2px' }}>{activeDataset.summary_stats?.rows || 0}</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Columns</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '2px' }}>{activeDataset.summary_stats?.columns || 0}</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Identifiers</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '2px', color: 'var(--warning)' }}>{activeDataset.summary_stats?.identifier_columns_count ?? 0}</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Numerical Measures</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '2px', color: 'var(--primary)' }}>{activeDataset.summary_stats?.numerical_columns_count ?? 0}</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Categorical</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '2px' }}>{activeDataset.summary_stats?.categorical_columns_count ?? 0}</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Date/Time</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '2px' }}>{activeDataset.summary_stats?.date_columns_count ?? 0}</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Missing Values</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '2px' }}>{activeDataset.summary_stats?.missing_values || 0}</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Duplicate Rows</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '2px' }}>{activeDataset.summary_stats?.duplicate_rows || 0}</div>
                </div>
              </div>
            </div>

            {/* NLQ Box */}
            <div className="glass-panel pulse-primary" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                <span>Ask AI Assistant</span>
              </h3>
              <form onSubmit={handleNLQSubmit} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Compare department salaries" 
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '10px' }}>
                  <Send size={16} />
                </button>
              </form>
              
              {nlqExplanation && (
                <div 
                  className={`insight-item ${nlqSuccess ? 'trend' : 'danger'}`} 
                  style={{ marginTop: '12px', padding: '10px', fontSize: '0.85rem', margin: 0, whiteSpace: 'pre-line' }}
                >
                  <div className="insight-message">{nlqExplanation}</div>
                </div>
              )}
            </div>

            {/* Config panel */}
            <div className="glass-panel">
              <h3 style={{ marginBottom: '16px', fontSize: '1.05rem' }}>Chart Configuration</h3>
              
              {/* Type Select */}
              <div className="form-group">
                <label className="form-label">Chart Type</label>
                <select 
                  className="form-input form-select"
                  value={selectedChart}
                  onChange={(e) => setSelectedChart(e.target.value)}
                >
                  <option value="Bar Chart">Bar Chart</option>
                  <option value="Line Chart">Line Chart</option>
                  <option value="Pie Chart">Pie Chart</option>
                  <option value="Donut Chart">Donut Chart</option>
                  <option value="Scatter Plot">Scatter Plot</option>
                  <option value="Histogram">Histogram</option>
                  <option value="Area Chart">Area Chart</option>
                  <option value="Radar Chart">Radar Chart</option>
                  <option value="Correlation Heatmap">Correlation Heatmap</option>
                </select>
              </div>

              {/* X-Axis Select */}
              {selectedChart !== 'Correlation Heatmap' && (
                <div className="form-group">
                  <label className="form-label">X-Axis Column</label>
                  <select 
                    className="form-input form-select"
                    value={xAxisCol}
                    onChange={(e) => setXAxisCol(e.target.value)}
                  >
                    {Object.keys(activeDataset.columns_metadata || {}).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Y-Axis Select */}
              {selectedChart !== 'Histogram' && selectedChart !== 'Correlation Heatmap' && (
                <div className="form-group">
                  <label className="form-label">Y-Axis Column</label>
                  <select 
                    className="form-input form-select"
                    value={yAxisCol}
                    onChange={(e) => setYAxisCol(e.target.value)}
                  >
                    <option value="count">Record Count (Aggregate Count)</option>
                    {Object.keys(activeDataset.columns_metadata || {}).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Label Customizations */}
              {selectedChart !== 'Correlation Heatmap' && (
                <div style={{ borderTop: '1px solid var(--surface-border)', marginTop: '16px', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>Customize Title & Labels</h4>
                  
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Chart Title</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      value={chartTitle} 
                      onChange={(e) => setChartTitle(e.target.value)} 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>X-Axis Label</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      value={xAxisLabel} 
                      onChange={(e) => setXAxisLabel(e.target.value)} 
                    />
                  </div>
                  
                  {selectedChart !== 'Histogram' && (
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Y-Axis Label</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        value={yAxisLabel} 
                        onChange={(e) => setYAxisLabel(e.target.value)} 
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Feature 1 & 2 & 3: Advanced Chart Controls */}
              {selectedChart !== 'Correlation Heatmap' && (
                <div style={{ borderTop: '1px solid var(--surface-border)', marginTop: '16px', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>Advanced Controls</h4>
                  
                  {/* Row Limit Selector */}
                  <div className="form-group" title="Limit the number of rows analyzed and plotted from the dataset">
                    <label className="form-label" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Row Limit
                      <HelpCircle size={12} style={{ color: 'var(--text-muted)' }} />
                    </label>
                    <select 
                      className="form-input form-select"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      value={rowLimit || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRowLimit(val ? parseInt(val) : null);
                      }}
                    >
                      <option value="">All Rows (Default)</option>
                      <option value="100">First 100 rows</option>
                      <option value="500">First 500 rows</option>
                      <option value="1000">First 1000 rows</option>
                    </select>
                  </div>

                  {rowLimit && (
                    <div className="form-group" title="Select whether to slice first rows or take a random sample">
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Sampling Method</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          type="button" 
                          className={`btn ${sampleMethod === 'first' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '4px 10px', fontSize: '0.75rem', flex: 1 }}
                          onClick={() => setSampleMethod('first')}
                        >
                          First Rows
                        </button>
                        <button 
                          type="button" 
                          className={`btn ${sampleMethod === 'random' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '4px 10px', fontSize: '0.75rem', flex: 1 }}
                          onClick={() => setSampleMethod('random')}
                        >
                          Random Sample
                        </button>
                      </div>
                    </div>
                  )}

                  {/* X-Axis Range Control */}
                  {isXNumeric && (
                    <div style={{ borderTop: '1px solid var(--surface-border)', marginTop: '12px', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>X-Axis Range</label>
                        <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={xAutoScale} 
                            onChange={(e) => setXAutoScale(e.target.checked)} 
                          />
                          Auto Scale
                        </label>
                      </div>
                      {!xAutoScale && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }} 
                            placeholder="Min X"
                            value={xMin}
                            onChange={(e) => setXMin(e.target.value)}
                          />
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }} 
                            placeholder="Max X"
                            value={xMax}
                            onChange={(e) => setXMax(e.target.value)}
                          />
                        </div>
                      )}
                      {xRangeWarning && (
                        <div style={{ color: 'var(--danger)', fontSize: '0.7rem', fontWeight: 600, marginTop: '2px' }}>
                          ⚠️ {xRangeWarning}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Y-Axis Range Control */}
                  {isYNumeric && (
                    <div style={{ borderTop: '1px solid var(--surface-border)', marginTop: '12px', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>Y-Axis Range</label>
                        <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={yAutoScale} 
                            onChange={(e) => setYAutoScale(e.target.checked)} 
                          />
                          Auto Scale
                        </label>
                      </div>
                      {!yAutoScale && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }} 
                            placeholder="Min Y"
                            value={yMin}
                            onChange={(e) => setYMin(e.target.value)}
                          />
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }} 
                            placeholder="Max Y"
                            value={yMax}
                            onChange={(e) => setYMax(e.target.value)}
                          />
                        </div>
                      )}
                      {yRangeWarning && (
                        <div style={{ color: 'var(--danger)', fontSize: '0.7rem', fontWeight: 600, marginTop: '2px' }}>
                          ⚠️ {yRangeWarning}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Generate Chart Button (Disabled state matches validateChartSelection) */}
              <button 
                type="button" 
                className={`btn ${validation.valid ? 'btn-primary' : 'btn-disabled'}`}
                style={{ 
                  width: '100%', 
                  marginTop: '16px', 
                  cursor: validation.valid ? 'pointer' : 'not-allowed',
                  opacity: validation.valid ? 1 : 0.55
                }}
                disabled={!validation.valid}
              >
                {validation.valid ? 'Generate Chart' : 'Generate Chart (Disabled)'}
              </button>

              {/* Recommendations block */}
              {recommendation && (
                <div className="insight-item trend" style={{ padding: '12px', fontSize: '0.82rem', marginTop: '16px', margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '2px' }}>
                    <Lightbulb size={14} />
                    <span>Smart Recommendation</span>
                  </div>
                  <p>{recommendation.text}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: chart view + validation alert + insights listing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
            <div className="glass-panel" ref={chartRef}>
              <div className="chart-header-row">
                <h3 style={{ fontSize: '1.1rem' }}>{selectedChart === 'Correlation Heatmap' ? 'Pearson Correlation Heatmap' : (chartTitle || `${selectedChart} Visualization`)}</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '6px 12px', fontSize: '0.85rem', cursor: validation.valid ? 'pointer' : 'not-allowed' }} 
                    disabled={!validation.valid} 
                    onClick={() => handleExport('png')}
                  >
                    <Download size={14} />
                    <span>Download PNG/PDF</span>
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '6px 12px', fontSize: '0.85rem', cursor: validation.valid ? 'pointer' : 'not-allowed' }} 
                    disabled={!validation.valid} 
                    onClick={() => handleExport('json')}
                  >
                    <FileDown size={14} />
                    <span>Export JSON</span>
                  </button>
                </div>
              </div>

              {/* Feature 7: Analysis Context & Row Visualizing Counter */}
              {activeDataset && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  background: 'rgba(99, 102, 241, 0.08)', 
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)'
                }}>
                  <Info size={14} style={{ color: 'var(--primary)' }} />
                  <div>
                    <span>Analysis based on: </span>
                    <strong style={{ color: 'var(--text)' }}>
                      {!rowLimit 
                        ? `Full Dataset (${activeDataset.summary_stats?.rows?.toLocaleString() || 0} rows)` 
                        : `${sampleMethod === 'random' ? 'Random Sample' : 'First'} (${rowLimit.toLocaleString()} rows)`}
                    </strong>
                    <span style={{ margin: '0 6px' }}>•</span>
                    <span>Visualizing {fullData.length.toLocaleString()} of {activeDataset.summary_stats?.rows?.toLocaleString() || 0} rows.</span>
                  </div>
                </div>
              )}

              {/* Immediate Validation Alert */}
              {!validation.valid && (
                <div className="insight-item danger" style={{ padding: '20px', fontSize: '0.875rem', marginBottom: '20px', borderLeft: '4px solid var(--danger)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 750, color: 'var(--danger)', marginBottom: '8px' }}>
                    <AlertTriangle size={18} />
                    <span>Chart cannot be generated</span>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>Reason: {validation.reason}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '8px' }}>{validation.message}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>💡 Suggestion: {validation.fix}</p>
                </div>
              )}

              {/* Chart Render Block */}
              {validation.valid ? (
                <div style={{ width: '100%', minHeight: '350px' }}>
                  {selectedChart === 'Correlation Heatmap' ? (
                    correlationMatrix.columns.length > 0 ? (
                      <div style={{ padding: '10px', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center', minWidth: '400px' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '8px', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.02)' }}>Metric</th>
                              {correlationMatrix.columns.map(col => (
                                <th key={col} style={{ padding: '8px', border: '1px solid var(--surface-border)', color: 'var(--text)' }}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {correlationMatrix.columns.map((rowCol, rIdx) => (
                              <tr key={rowCol}>
                                <td style={{ padding: '8px', border: '1px solid var(--surface-border)', fontWeight: 600, color: 'var(--text)', textAlign: 'left', background: 'rgba(0,0,0,0.01)' }}>{rowCol}</td>
                                {correlationMatrix.columns.map((colCol, cIdx) => {
                                  const rVal = correlationMatrix.matrix[rIdx]?.[cIdx];
                                  const isNull = rVal === null || rVal === undefined;
                                  
                                  let bg = 'rgba(0, 0, 0, 0.05)';
                                  let textCol = 'var(--text)';
                                  if (!isNull) {
                                    if (rVal > 0) {
                                      bg = `rgba(99, 102, 241, ${rVal})`;
                                      textCol = rVal > 0.5 ? '#fff' : 'var(--text)';
                                    } else if (rVal < 0) {
                                      bg = `rgba(239, 68, 68, ${Math.abs(rVal)})`;
                                      textCol = Math.abs(rVal) > 0.5 ? '#fff' : 'var(--text)';
                                    } else {
                                      bg = 'rgba(0, 0, 0, 0.02)';
                                    }
                                  }
                                  
                                  return (
                                    <td 
                                      key={colCol} 
                                      style={{ 
                                        padding: '12px 8px', 
                                        border: '1px solid var(--surface-border)', 
                                        background: bg,
                                        color: textCol,
                                        fontWeight: 'bold',
                                        transition: 'background 0.2s'
                                      }}
                                      title={`${rowCol} ↔ ${colCol}: ${isNull ? 'N/A' : rVal.toFixed(3)}`}
                                    >
                                      {isNull ? 'N/A' : rVal.toFixed(2)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ height: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <Grid size={44} style={{ marginBottom: '10px' }} />
                        <p>No Numerical Measure columns found to calculate a correlation matrix.</p>
                      </div>
                    )
                  ) : chartData.length > 0 ? (
                    <div style={{ position: 'relative', width: '100%' }}>
                      {zoomXDomain && (
                        <button 
                          type="button"
                          className="btn btn-secondary" 
                          style={{ 
                            position: 'absolute', 
                            top: '5px', 
                            right: '20px', 
                            zIndex: 20, 
                            padding: '4px 10px', 
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                          onClick={() => setZoomXDomain(null)}
                        >
                          Reset Zoom
                        </button>
                      )}
                      <ResponsiveContainer width="100%" height={350}>
                        {selectedChart === 'Bar Chart' ? (
                          <BarChart 
                            data={chartData} 
                            margin={{ top: 15, right: 15, bottom: 20, left: 15 }}
                            onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
                            onMouseMove={(e) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
                            onMouseUp={handleZoom}
                            onDoubleClick={() => setZoomXDomain(null)}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                            <XAxis dataKey="name" stroke="var(--text-secondary)" domain={getXDomain()}>
                              <Label value={xAxisLabel} offset={-10} position="insideBottom" fill="var(--text-secondary)" style={{ fontSize: '0.75rem', fontWeight: 600 }} />
                            </XAxis>
                            <YAxis stroke="var(--text-secondary)" domain={getYDomain()}>
                              <Label value={yAxisLabel} angle={-90} position="insideLeft" offset={0} fill="var(--text-secondary)" style={{ fontSize: '0.75rem', fontWeight: 600 }} />
                            </YAxis>
                            <Tooltip contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--surface-border)' }} />
                            <Legend verticalAlign="top" height={36} />
                            <Bar dataKey={yAxisCol} name={yAxisLabel} fill="var(--primary)" radius={[4, 4, 0, 0]} />
                            {refAreaLeft && refAreaRight && (
                              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="var(--primary)" fillOpacity={0.15} />
                            )}
                            <Brush dataKey="name" height={20} stroke="var(--primary)" fill="var(--background)" />
                          </BarChart>
                        ) : selectedChart === 'Line Chart' ? (
                          <LineChart 
                            data={chartData} 
                            margin={{ top: 15, right: 15, bottom: 20, left: 15 }}
                            onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
                            onMouseMove={(e) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
                            onMouseUp={handleZoom}
                            onDoubleClick={() => setZoomXDomain(null)}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                            <XAxis dataKey="name" stroke="var(--text-secondary)" domain={getXDomain()}>
                              <Label value={xAxisLabel} offset={-10} position="insideBottom" fill="var(--text-secondary)" style={{ fontSize: '0.75rem', fontWeight: 600 }} />
                            </XAxis>
                            <YAxis stroke="var(--text-secondary)" domain={getYDomain()}>
                              <Label value={yAxisLabel} angle={-90} position="insideLeft" offset={0} fill="var(--text-secondary)" style={{ fontSize: '0.75rem', fontWeight: 600 }} />
                            </YAxis>
                            <Tooltip contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--surface-border)' }} />
                            <Legend verticalAlign="top" height={36} />
                            <Line type="monotone" dataKey={yAxisCol} name={yAxisLabel} stroke="var(--primary)" strokeWidth={2.5} activeDot={{ r: 8 }} />
                            {refAreaLeft && refAreaRight && (
                              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="var(--primary)" fillOpacity={0.15} />
                            )}
                            <Brush dataKey="name" height={20} stroke="var(--primary)" fill="var(--background)" />
                          </LineChart>
                        ) : selectedChart === 'Area Chart' ? (
                          <AreaChart 
                            data={chartData} 
                            margin={{ top: 15, right: 15, bottom: 20, left: 15 }}
                            onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
                            onMouseMove={(e) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
                            onMouseUp={handleZoom}
                            onDoubleClick={() => setZoomXDomain(null)}
                          >
                            <defs>
                               <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                                 <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0}/>
                               </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                            <XAxis dataKey="name" stroke="var(--text-secondary)" domain={getXDomain()}>
                              <Label value={xAxisLabel} offset={-10} position="insideBottom" fill="var(--text-secondary)" style={{ fontSize: '0.75rem', fontWeight: 600 }} />
                            </XAxis>
                            <YAxis stroke="var(--text-secondary)" domain={getYDomain()}>
                              <Label value={yAxisLabel} angle={-90} position="insideLeft" offset={0} fill="var(--text-secondary)" style={{ fontSize: '0.75rem', fontWeight: 600 }} />
                            </YAxis>
                            <Tooltip contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--surface-border)' }} />
                            <Legend verticalAlign="top" height={36} />
                            <Area type="monotone" dataKey={yAxisCol} name={yAxisLabel} stroke="var(--primary)" fillOpacity={1} fill="url(#areaGlow)" strokeWidth={2.5} />
                            {refAreaLeft && refAreaRight && (
                              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="var(--primary)" fillOpacity={0.15} />
                            )}
                            <Brush dataKey="name" height={20} stroke="var(--primary)" fill="var(--background)" />
                          </AreaChart>
                        ) : (selectedChart === 'Pie Chart' || selectedChart === 'Donut Chart') ? (
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              innerRadius={selectedChart === 'Donut Chart' ? 55 : 0}
                              fill="#8884d8"
                              dataKey={yAxisCol}
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--surface-border)' }} />
                            <Legend />
                          </PieChart>
                        ) : selectedChart === 'Scatter Plot' ? (
                          <ScatterChart 
                            margin={{ top: 15, right: 15, bottom: 20, left: 15 }}
                            onMouseDown={(e) => e && setRefAreaLeft(e.xValue || (e.activePayload && e.activePayload[0]?.payload?.[xAxisCol]))}
                            onMouseMove={(e) => refAreaLeft && e && setRefAreaRight(e.xValue || (e.activePayload && e.activePayload[0]?.payload?.[xAxisCol]))}
                            onMouseUp={handleZoom}
                            onDoubleClick={() => setZoomXDomain(null)}
                          >
                            <CartesianGrid stroke="var(--chart-grid)" />
                            <XAxis type="number" dataKey={xAxisCol} name={xAxisLabel} stroke="var(--text-secondary)" domain={getXDomain()}>
                              <Label value={xAxisLabel} offset={-10} position="insideBottom" fill="var(--text-secondary)" style={{ fontSize: '0.75rem', fontWeight: 600 }} />
                            </XAxis>
                            <YAxis type="number" dataKey={yAxisCol} name={yAxisLabel} stroke="var(--text-secondary)" domain={getYDomain()}>
                              <Label value={yAxisLabel} angle={-90} position="insideLeft" offset={0} fill="var(--text-secondary)" style={{ fontSize: '0.75rem', fontWeight: 600 }} />
                            </YAxis>
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--surface-border)' }} />
                            <Legend verticalAlign="top" height={36} />
                            <Scatter name={`${xAxisLabel} vs ${yAxisLabel}`} data={chartData} fill="var(--primary)" />
                            {refAreaLeft && refAreaRight && (
                              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="var(--primary)" fillOpacity={0.15} />
                            )}
                            <Brush dataKey={xAxisCol} height={20} stroke="var(--primary)" fill="var(--background)" />
                          </ScatterChart>
                        ) : selectedChart === 'Histogram' ? (
                          <BarChart 
                            data={chartData} 
                            margin={{ top: 15, right: 15, bottom: 20, left: 15 }}
                            onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
                            onMouseMove={(e) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
                            onMouseUp={handleZoom}
                            onDoubleClick={() => setZoomXDomain(null)}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                            <XAxis dataKey="name" stroke="var(--text-secondary)" domain={getXDomain()}>
                              <Label value={xAxisLabel} offset={-10} position="insideBottom" fill="var(--text-secondary)" style={{ fontSize: '0.75rem', fontWeight: 600 }} />
                            </XAxis>
                            <YAxis stroke="var(--text-secondary)" domain={getYDomain()}>
                              <Label value="Frequency" angle={-90} position="insideLeft" offset={0} fill="var(--text-secondary)" style={{ fontSize: '0.75rem', fontWeight: 600 }} />
                            </YAxis>
                            <Tooltip contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--surface-border)' }} />
                            <Bar dataKey="count" name="Frequency" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                            {refAreaLeft && refAreaRight && (
                              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="var(--primary)" fillOpacity={0.15} />
                            )}
                            <Brush dataKey="name" height={20} stroke="var(--primary)" fill="var(--background)" />
                          </BarChart>
                        ) : selectedChart === 'Radar Chart' ? (
                          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                            <PolarGrid stroke="var(--chart-grid)" />
                            <PolarAngleAxis dataKey="name" stroke="var(--text-secondary)" />
                            <PolarRadiusAxis stroke="var(--text-secondary)" />
                            <Radar name={yAxisLabel} dataKey={yAxisCol} stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.25} />
                            <Tooltip contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--surface-border)' }} />
                            <Legend />
                          </RadarChart>
                        ) : null}
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div style={{ height: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <BarChart3 size={44} style={{ marginBottom: '10px' }} />
                      <p>Plotting area requires X and Y variables to map data points.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ height: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <AlertTriangle size={44} style={{ marginBottom: '10px', color: 'var(--danger)' }} />
                  <p>Invalid configuration. Fix the validation errors to render the chart.</p>
                </div>
              )}
            </div>

            {/* AI Insights section */}
            <div className="insights-drawer animate-fade-in">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', marginBottom: '16px' }}>
                <Lightbulb size={18} style={{ color: 'var(--warning)' }} />
                <span>AI Generated Analytics Insights</span>
              </h3>
              
              {getCategoryComparisonInsight() && (
                <div className="insight-item info animate-fade-in" style={{ marginBottom: '16px', borderLeft: '4px solid var(--primary)', margin: '0 0 16px 0' }}>
                  <div className="insight-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--primary)' }}>
                    <Sparkles size={14} />
                    <span>{getCategoryComparisonInsight().title}</span>
                  </div>
                  <p style={{ fontWeight: 650, fontSize: '0.9rem', marginTop: '4px', color: 'var(--text)' }}>
                    {getCategoryComparisonInsight().message}
                  </p>
                </div>
              )}

              {insights.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No statistical insights calculated. Ensure dataset has clean entries.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  {insights.map((ins, idx) => (
                    <div key={idx} className={`insight-item ${ins.severity === 'warning' ? 'warning' : ins.type === 'trend' ? 'trend' : 'info'}`} style={{ margin: 0 }}>
                      <div className="insight-title">{ins.title}</div>
                      <div className="insight-message">{ins.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VizStudio;
