import React, { useState, useEffect } from 'react';
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
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  LayoutDashboard, 
  Plus, 
  Save, 
  Trash2, 
  Star, 
  Share2, 
  Database,
  ArrowRight,
  Calculator,
  Grid,
  ChevronDown
} from 'lucide-react';

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const DashboardBuilder = () => {
  const [activeDataset, setActiveDataset] = useState(null);
  const [fullData, setFullData] = useState([]);
  
  // Dashboard Management State
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [dashboardName, setDashboardName] = useState('My Analytics Dashboard');
  const [layout, setLayout] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [statsColumn, setStatsColumn] = useState('');
  
  // Modal / Add Widget Form State
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [widgetTitle, setWidgetTitle] = useState('New Chart');
  const [widgetChartType, setWidgetChartType] = useState('Bar Chart');
  const [widgetXAxis, setWidgetXAxis] = useState('');
  const [widgetYAxis, setWidgetYAxis] = useState('count');
  const [widgetWidth, setWidgetWidth] = useState(6); // 6 (half) or 12 (full)

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loadInitialData = async () => {
    const datasetId = localStorage.getItem('activeDatasetId');
    if (!datasetId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const detail = await api.get(`/datasets/${datasetId}`);
      setActiveDataset(detail);
      
      const res = await api.get(`/datasets/${datasetId}/preview?page=1&page_size=100`);
      setFullData(res.data);

      // Default stats column
      const numCols = Object.keys(detail.columns_metadata || {}).filter(c => detail.columns_metadata[c] === 'Numerical Measure');
      if (numCols.length > 0) {
        setStatsColumn(numCols[0]);
      }
      
      // Default Widget Selectors
      const cols = Object.keys(detail.columns_metadata || {});
      if (cols.length > 0) {
        setWidgetXAxis(cols[0]);
      }
      
      // Load saved dashboards
      const boards = await api.get('/dashboards');
      setDashboards(boards);
      if (boards.length > 0) {
        loadDashboard(boards[0]);
      } else {
        // Create initial default layout
        setLayout([
          {
            id: '1',
            title: 'Records Breakdown',
            type: 'Pie Chart',
            x_axis: cols.find(c => detail.columns_metadata[c] === 'Categorical') || cols[0],
            y_axis: 'count',
            width: 6
          },
          {
            id: '2',
            title: 'Value Comparison',
            type: 'Bar Chart',
            x_axis: cols.find(c => detail.columns_metadata[c] === 'Categorical') || cols[0],
            y_axis: numCols[0] || 'count',
            width: 6
          }
        ]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard parameters.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadDashboard = (board) => {
    setSelectedDashboard(board);
    setDashboardName(board.name);
    setLayout(board.layout);
    setIsFavorite(board.is_favorite);
  };

  const handleSaveDashboard = async () => {
    if (!activeDataset) return;
    try {
      if (selectedDashboard) {
        // Update existing
        const res = await api.put(`/dashboards/${selectedDashboard.id}`, {
          name: dashboardName,
          layout: layout,
          is_favorite: isFavorite
        });
        setSelectedDashboard(res);
      } else {
        // Create new
        const res = await api.post('/dashboards', {
          name: dashboardName,
          layout: layout
        });
        setSelectedDashboard(res);
        // Refresh list
        const boards = await api.get('/dashboards');
        setDashboards(boards);
      }
      alert('Dashboard saved successfully!');
    } catch (err) {
      console.error(err);
      setError('Failed to save dashboard layout.');
    }
  };

  const handleCreateNewDashboard = () => {
    setSelectedDashboard(null);
    setDashboardName('New Dashboard');
    setLayout([]);
    setIsFavorite(false);
  };

  const handleDeleteDashboard = async () => {
    if (!selectedDashboard) return;
    if (!confirm('Are you sure you want to delete this saved dashboard?')) return;
    try {
      await api.delete(`/dashboards/${selectedDashboard.id}`);
      setSelectedDashboard(null);
      setDashboardName('My Analytics Dashboard');
      setLayout([]);
      setIsFavorite(false);
      // Refresh list
      const boards = await api.get('/dashboards');
      setDashboards(boards);
    } catch (err) {
      console.error(err);
      setError('Failed to delete dashboard.');
    }
  };

  const handleAddWidget = (e) => {
    e.preventDefault();
    
    const xType = activeDataset?.columns_metadata[widgetXAxis];
    const yType = activeDataset?.columns_metadata[widgetYAxis];
    if (xType === 'Identifier (ID)') {
      alert(`${widgetXAxis} is an identifier column and has been excluded from statistical analysis.`);
      return;
    }
    if (widgetYAxis !== 'count' && yType === 'Identifier (ID)') {
      alert(`${widgetYAxis} is an identifier column and has been excluded from statistical analysis.`);
      return;
    }

    const newWidget = {
      id: Date.now().toString(),
      title: widgetTitle,
      type: widgetChartType,
      x_axis: widgetXAxis,
      y_axis: widgetYAxis,
      width: parseInt(widgetWidth)
    };
    setLayout([...layout, newWidget]);
    setShowAddWidget(false);
    
    // Reset Form
    setWidgetTitle('New Chart');
  };

  const handleDeleteWidget = (id) => {
    setLayout(layout.filter(w => w.id !== id));
  };

  // Real-time Summary Cards calculation
  const calculateStats = () => {
    if (fullData.length === 0 || !statsColumn) return {};
    
    const values = fullData.map(d => parseFloat(d[statsColumn])).filter(v => !isNaN(v));
    if (values.length === 0) return {};
    
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    // Std dev and Variance
    const sqDiffs = values.map(v => Math.pow(v - avg, 2));
    const variance = sqDiffs.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      average: avg.toFixed(2),
      median: median.toFixed(2),
      maximum: max.toLocaleString(),
      minimum: min.toLocaleString(),
      stdDev: stdDev.toFixed(2),
      variance: variance.toFixed(2)
    };
  };

  // Helper to compile data for specific widget rendering
  const getWidgetChartData = (widget) => {
    if (fullData.length === 0 || !widget.x_axis || !widget.y_axis) return [];
    
    const xType = activeDataset?.columns_metadata[widget.x_axis];
    const yType = activeDataset?.columns_metadata[widget.y_axis];
    if (xType === 'Identifier (ID)' || (widget.y_axis !== 'count' && yType === 'Identifier (ID)')) {
      return [];
    }
    if (widget.y_axis === 'count' || xType === 'Categorical') {
      const groups = {};
      fullData.forEach(item => {
        const key = item[widget.x_axis] !== null ? item[widget.x_axis].toString() : 'null';
        if (!groups[key]) {
          groups[key] = { name: key, count: 0, sum: 0, records: 0 };
        }
        groups[key].records++;
        if (widget.y_axis !== 'count') {
          const val = parseFloat(item[widget.y_axis]);
          if (!isNaN(val)) groups[key].sum += val;
        }
      });
      
      return Object.values(groups).map(g => ({
        name: g.name,
        [widget.y_axis]: widget.y_axis === 'count' ? g.records : parseFloat((g.sum / (g.records || 1)).toFixed(2))
      })).slice(0, 10);
    }
    
    return fullData.map(item => ({
      name: item[widget.x_axis] !== null ? item[widget.x_axis].toString() : '',
      [widget.y_axis]: parseFloat(item[widget.y_axis])
    })).slice(0, 20);
  };

  const stats = calculateStats();
  const numericalColumns = activeDataset 
    ? Object.keys(activeDataset.columns_metadata || {}).filter(c => activeDataset.columns_metadata[c] === 'Numerical Measure')
    : [];

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input 
            type="text" 
            className="form-input" 
            value={dashboardName}
            onChange={(e) => setDashboardName(e.target.value)}
            style={{ 
              fontSize: '1.8rem', 
              fontWeight: 800, 
              background: 'transparent', 
              border: 'none', 
              outline: 'none',
              padding: 0,
              width: '350px',
              fontFamily: 'var(--font-display)',
              color: 'var(--text)'
            }}
          />
          <button 
            className="logout-btn" 
            onClick={() => setIsFavorite(!isFavorite)}
            style={{ color: isFavorite ? 'var(--warning)' : 'var(--text-muted)', padding: '6px' }}
          >
            <Star fill={isFavorite ? 'var(--warning)' : 'none'} size={20} />
          </button>
        </div>
        
        {activeDataset && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setShowAddWidget(true)}>
              <Plus size={18} />
              <span>Add Widget</span>
            </button>
            <button className="btn btn-primary" onClick={handleSaveDashboard}>
              <Save size={18} />
              <span>Save Board</span>
            </button>
            {selectedDashboard && (
              <button className="btn btn-danger" onClick={handleDeleteDashboard}>
                <Trash2 size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="insight-item danger" style={{ marginBottom: '24px' }}>
          <span>{error}</span>
        </div>
      )}

      {!activeDataset ? (
        <div className="glass-panel" style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center' }}>
          <Database size={48} style={{ color: 'var(--text-muted)' }} />
          <h3>Select a Dataset</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '300px' }}>
            Please select or upload a dataset file in the Dataset Workspace before plotting dashboards.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/upload')}>
            <span>Go to Upload</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Dashboard Selector Menu & Options */}
          <div className="glass-panel" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <LayoutDashboard size={18} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Active Dashboards:</span>
              <select 
                className="form-input form-select"
                style={{ padding: '6px 12px', width: '220px', fontSize: '0.85rem' }}
                value={selectedDashboard ? selectedDashboard.id : ''}
                onChange={(e) => {
                  const found = dashboards.find(d => d.id.toString() === e.target.value.toString());
                  if (found) loadDashboard(found);
                }}
              >
                <option value="">-- Customize Grid (Unsaved) --</option>
                {dashboards.map(d => (
                  <option key={d.id} value={d.id}>{d.name} {d.is_favorite ? '★' : ''}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={handleCreateNewDashboard}>
              <span>New Dashboard Layout</span>
            </button>
          </div>

          {/* Metric calculation selector and Stats cards */}
          {numericalColumns.length > 0 && (
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calculator size={18} style={{ color: 'var(--primary)' }} />
                  <span>Interactive Statistics Summary</span>
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Selected Metric:</span>
                  <select 
                    className="form-input form-select" 
                    style={{ padding: '4px 10px', fontSize: '0.82rem', width: '160px' }}
                    value={statsColumn}
                    onChange={(e) => setStatsColumn(e.target.value)}
                  >
                    {numericalColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Statistical Cards Grid */}
              <div className="grid-cards" style={{ margin: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div className="glass-panel stat-card" style={{ padding: '14px', margin: 0 }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem' }}>Average</span>
                  <span className="stat-value" style={{ fontSize: '1.6rem', marginTop: '6px' }}>{stats.average || 0}</span>
                </div>
                <div className="glass-panel stat-card accent" style={{ padding: '14px', margin: 0 }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem' }}>Median</span>
                  <span className="stat-value" style={{ fontSize: '1.6rem', marginTop: '6px' }}>{stats.median || 0}</span>
                </div>
                <div className="glass-panel stat-card" style={{ padding: '14px', margin: 0 }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem' }}>Maximum</span>
                  <span className="stat-value" style={{ fontSize: '1.6rem', marginTop: '6px' }}>{stats.maximum || 0}</span>
                </div>
                <div className="glass-panel stat-card" style={{ padding: '14px', margin: 0 }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem' }}>Minimum</span>
                  <span className="stat-value" style={{ fontSize: '1.6rem', marginTop: '6px' }}>{stats.minimum || 0}</span>
                </div>
                <div className="glass-panel stat-card warning" style={{ padding: '14px', margin: 0 }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem' }}>Std Deviation</span>
                  <span className="stat-value" style={{ fontSize: '1.6rem', marginTop: '6px' }}>{stats.stdDev || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Grid Layout Canvas */}
          <div className="dashboard-grid">
            {layout.map(widget => {
              const widgetData = getWidgetChartData(widget);
              const gridClass = widget.width === 12 ? 'widget-col-12' : 'widget-col-6';
              
              return (
                <div 
                  key={widget.id} 
                  className={`glass-panel dashboard-widget ${gridClass}`} 
                  style={{ margin: 0 }}
                >
                  <div className="widget-header">
                    <span className="widget-title">{widget.title}</span>
                    <button className="logout-btn" onClick={() => handleDeleteWidget(widget.id)} style={{ padding: '4px' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="widget-body">
                    {widgetData.length > 0 ? (
                      <div style={{ width: '100%', height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          {widget.type === 'Bar Chart' ? (
                            <BarChart data={widgetData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                              <YAxis stroke="var(--text-secondary)" fontSize={11} />
                              <Tooltip contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--surface-border)' }} />
                              <Bar dataKey={widget.y_axis} fill="var(--primary)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          ) : widget.type === 'Line Chart' ? (
                            <LineChart data={widgetData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                              <YAxis stroke="var(--text-secondary)" fontSize={11} />
                              <Tooltip contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--surface-border)' }} />
                              <Line type="monotone" dataKey={widget.y_axis} stroke="var(--primary)" strokeWidth={2} />
                            </LineChart>
                          ) : widget.type === 'Area Chart' ? (
                            <AreaChart data={widgetData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                              <YAxis stroke="var(--text-secondary)" fontSize={11} />
                              <Tooltip contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--surface-border)' }} />
                              <Area type="monotone" dataKey={widget.y_axis} stroke="var(--primary)" fill="var(--primary-glow)" />
                            </AreaChart>
                          ) : (widget.type === 'Pie Chart' || widget.type === 'Donut Chart') ? (
                            <PieChart>
                              <Pie
                                data={widgetData}
                                cx="50%"
                                cy="50%"
                                outerRadius={70}
                                innerRadius={widget.type === 'Donut Chart' ? 45 : 0}
                                fill="#8884d8"
                                dataKey={widget.y_axis}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                              >
                                {widgetData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ background: 'var(--chart-tooltip)', border: '1px solid var(--surface-border)' }} />
                            </PieChart>
                          ) : null}
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data matching variables.</span>
                    )}
                  </div>
                </div>
              );
            })}

            {layout.length === 0 && (
              <div className="glass-panel" style={{ gridColumn: 'span 12', height: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center' }}>
                <Grid size={32} style={{ marginBottom: '8px' }} />
                <h4>Empty Dashboard Grid</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Click "Add Widget" above to start populating this dashboard layout.</p>
              </div>
            )}
          </div>

          {/* Add Widget Panel Modal */}
          {showAddWidget && (
            <div style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 200,
              padding: '20px'
            }}>
              <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '460px', background: 'var(--background)' }}>
                <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={20} style={{ color: 'var(--primary)' }} />
                  <span>Configure New Widget</span>
                </h3>

                <form onSubmit={handleAddWidget}>
                  <div className="form-group">
                    <label className="form-label">Widget Title</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={widgetTitle}
                      onChange={(e) => setWidgetTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Visualization Type</label>
                    <select 
                      className="form-input form-select"
                      value={widgetChartType}
                      onChange={(e) => setWidgetChartType(e.target.value)}
                    >
                      <option value="Bar Chart">Bar Chart</option>
                      <option value="Line Chart">Line Chart</option>
                      <option value="Pie Chart">Pie Chart</option>
                      <option value="Donut Chart">Donut Chart</option>
                      <option value="Area Chart">Area Chart</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">X-Axis Column</label>
                    <select 
                      className="form-input form-select"
                      value={widgetXAxis}
                      onChange={(e) => setWidgetXAxis(e.target.value)}
                    >
                      {Object.keys(activeDataset.columns_metadata || {}).map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Y-Axis Column</label>
                    <select 
                      className="form-input form-select"
                      value={widgetYAxis}
                      onChange={(e) => setWidgetYAxis(e.target.value)}
                    >
                      <option value="count">Record Count (Aggregate Count)</option>
                      {Object.keys(activeDataset.columns_metadata || {}).map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Widget Width</label>
                    <select 
                      className="form-input form-select"
                      value={widgetWidth}
                      onChange={(e) => setWidgetWidth(e.target.value)}
                    >
                      <option value="6">Half Screen Grid (2 per row)</option>
                      <option value="12">Full Width Grid (1 per row)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Add Widget</button>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ flexGrow: 1 }}
                      onClick={() => setShowAddWidget(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default DashboardBuilder;
