import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Database, 
  ArrowRight, 
  AlertCircle, 
  Trash2, 
  ChevronRight,
  RefreshCw,
  Search,
  History,
  CheckCircle2
} from 'lucide-react';

const Upload = () => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [activeDataset, setActiveDataset] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewSearch, setPreviewSearch] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Load user datasets
  const fetchDatasets = async () => {
    try {
      const data = await api.get('/datasets');
      setDatasets(data);
      
      // If there's an active dataset ID in localStorage, select it
      const savedActiveId = localStorage.getItem('activeDatasetId');
      if (savedActiveId) {
        const found = data.find(d => d.id.toString() === savedActiveId.toString());
        if (found) {
          setActiveDataset(found);
        } else if (data.length > 0) {
          selectDataset(data[0]);
        }
      } else if (data.length > 0) {
        selectDataset(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch datasets:', err);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  // Fetch dataset preview
  const fetchPreview = async (datasetId, page = 1, search = '') => {
    if (!datasetId) return;
    try {
      const queryParams = `?page=${page}&page_size=10${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      const res = await api.get(`/datasets/${datasetId}/preview${queryParams}`);
      setPreviewData(res.data);
      setPreviewTotal(res.total_records);
    } catch (err) {
      console.error('Failed to load dataset preview:', err);
    }
  };

  useEffect(() => {
    if (activeDataset) {
      fetchPreview(activeDataset.id, previewPage, previewSearch);
    }
  }, [activeDataset, previewPage]);

  const selectDataset = (dataset) => {
    setActiveDataset(dataset);
    localStorage.setItem('activeDatasetId', dataset.id);
    setPreviewPage(1);
    setPreviewSearch('');
    fetchPreview(dataset.id, 1, '');
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const uploadFile = async (file) => {
    setError('');
    setUploading(true);
    try {
      const result = await api.upload('/datasets/upload', file);
      // Refresh datasets
      await fetchDatasets();
      // Set uploaded as active
      const activeObj = {
        id: result.id,
        name: result.name,
        file_type: result.file_type,
        columns_metadata: result.columns_metadata,
        summary_stats: result.summary_stats,
        cleaning_history: result.cleaning_history
      };
      setActiveDataset(activeObj);
      localStorage.setItem('activeDatasetId', result.id);
      fetchPreview(result.id, 1, '');
    } catch (err) {
      setError(err.message || 'Failed to upload dataset. Check file formatting.');
    } finally {
      setUploading(false);
    }
  };

  const deleteDataset = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this dataset? All saved configurations relying on this will be affected.')) return;
    try {
      await api.delete(`/datasets/${id}`);
      if (activeDataset && activeDataset.id === id) {
        localStorage.removeItem('activeDatasetId');
        setActiveDataset(null);
        setPreviewData([]);
      }
      fetchDatasets();
    } catch (err) {
      setError('Failed to delete dataset.');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (activeDataset) {
      setPreviewPage(1);
      fetchPreview(activeDataset.id, 1, previewSearch);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dataset Workspace</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Upload a new dataset or choose an existing one to analyze</p>
        </div>
      </div>

      {error && (
        <div className="insight-item danger" style={{ marginBottom: '24px' }}>
          <div className="insight-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>Upload Failed</span>
          </div>
          <div className="insight-message">{error}</div>
        </div>
      )}

      <div className="split-workspace">
        {/* Left Side: Drag & Drop + History list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div 
            className={`dropzone glass-panel ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              style={{ display: 'none' }} 
              accept=".csv,.xlsx,.xls,.json"
              onChange={handleFileChange}
            />
            {uploading ? (
              <>
                <RefreshCw size={44} className="animate-spin text-secondary" style={{ color: 'var(--primary)' }} />
                <h3>Analyzing dataset...</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Classifying columns & computing summary stats</p>
              </>
            ) : (
              <>
                <UploadCloud size={44} className="dropzone-icon" />
                <h3>Drag & Drop Dataset</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Supports CSV, Excel (.xlsx), and JSON</p>
                <button className="btn btn-secondary" style={{ marginTop: '8px' }}>Browse Files</button>
              </>
            )}
          </div>

          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} />
              <span>Dataset History</span>
            </h3>
            
            {datasets.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', padding: '20px 0' }}>
                No datasets uploaded yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxH: '300px', overflowY: 'auto' }}>
                {datasets.map(d => (
                  <div 
                    key={d.id} 
                    className={`glass-panel interactive ${activeDataset && activeDataset.id === d.id ? 'pulse-primary' : ''}`}
                    style={{ 
                      padding: '12px 16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      borderLeft: activeDataset && activeDataset.id === d.id ? '4px solid var(--primary)' : '1px solid var(--surface-border)',
                      margin: 0
                    }}
                    onClick={() => selectDataset(d)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                      <FileSpreadsheet style={{ color: 'var(--primary)', flexShrink: 0 }} size={20} />
                      <div style={{ overflow: 'hidden' }}>
                        <h4 style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{d.file_type.toUpperCase()} • {d.summary_stats?.rows || 0} rows</span>
                      </div>
                    </div>
                    <button 
                      className="logout-btn" 
                      onClick={(e) => deleteDataset(d.id, e)}
                      style={{ padding: '6px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Details & Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
          {activeDataset ? (
            <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px' }}>{activeDataset.name}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Uploaded on {new Date(activeDataset.created_at || new Date()).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" onClick={() => navigate('/clean')}>
                    <span>Clean Dataset</span>
                  </button>
                  <button className="btn btn-primary" onClick={() => navigate('/studio')}>
                    <span>Viz Studio</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>

              {/* Statistics Cards */}
              <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                <div className="glass-panel stat-card" style={{ padding: '12px', margin: 0 }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem' }}>Total Rows</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem' }}>{activeDataset.summary_stats?.rows?.toLocaleString() || 0}</span>
                </div>
                <div className="glass-panel stat-card accent" style={{ padding: '12px', margin: 0 }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem' }}>Total Columns</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem' }}>{activeDataset.summary_stats?.columns || 0}</span>
                </div>
                <div className="glass-panel stat-card warning" style={{ padding: '12px', margin: 0 }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem' }}>Missing Cells</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem' }}>{activeDataset.summary_stats?.missing_values?.toLocaleString() || 0}</span>
                </div>
                <div className="glass-panel stat-card danger" style={{ padding: '12px', margin: 0 }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem' }}>Duplicate Rows</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem' }}>{activeDataset.summary_stats?.duplicate_rows?.toLocaleString() || 0}</span>
                </div>
                <div className="glass-panel stat-card" style={{ padding: '12px', margin: 0 }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem' }}>Identifiers</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--warning)' }}>{activeDataset.summary_stats?.identifier_columns_count ?? 0}</span>
                </div>
                <div className="glass-panel stat-card" style={{ padding: '12px', margin: 0 }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem' }}>Numerical Measures</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>{activeDataset.summary_stats?.numerical_columns_count ?? 0}</span>
                </div>
                <div className="glass-panel stat-card" style={{ padding: '12px', margin: 0 }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem' }}>Categorical</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem' }}>{activeDataset.summary_stats?.categorical_columns_count ?? 0}</span>
                </div>
                <div className="glass-panel stat-card" style={{ padding: '12px', margin: 0 }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem' }}>Date Columns</span>
                  <span className="stat-value" style={{ fontSize: '1.4rem' }}>{activeDataset.summary_stats?.date_columns_count ?? 0}</span>
                </div>
              </div>

              {/* Data types list */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Columns & Detected Data Types</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {activeDataset.columns_metadata && Object.entries(activeDataset.columns_metadata).map(([col, type]) => (
                    <div 
                      key={col} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '6px 12px', 
                        borderRadius: '8px',
                        background: 'rgba(0,0,0,0.1)',
                        border: '1px solid var(--surface-border)'
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{col}</span>
                      <span className={`badge badge-${type?.toLowerCase().replace('/', '')}`}>{type}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Dataset Preview</h3>
                  
                  <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Search records..." 
                        style={{ padding: '6px 12px 6px 32px', fontSize: '0.85rem', width: '200px' }}
                        value={previewSearch}
                        onChange={(e) => setPreviewSearch(e.target.value)}
                      />
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    </div>
                    <button type="submit" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Search</button>
                  </form>
                </div>

                {previewData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', border: '1px solid var(--surface-border)', borderRadius: '8px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>No records match your search criteria.</p>
                  </div>
                ) : (
                  <>
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            {previewData.length > 0 && Object.keys(previewData[0]).map(key => (
                              <th key={key}>{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, idx) => (
                            <tr key={idx}>
                              {Object.values(row).map((val, i) => {
                                const isNull = val === null || val === undefined || val === '' || (typeof val === 'number' && isNaN(val)) || val === 'NaN' || val === 'null';
                                return (
                                  <td key={i}>
                                    {isNull ? (
                                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.82rem' }}>[null]</span>
                                    ) : val.toString()}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', align: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span>Showing {previewData.length} of {previewTotal} records</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          disabled={previewPage === 1}
                          onClick={() => setPreviewPage(prev => Math.max(1, prev - 1))}
                        >
                          Previous
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', px: '8px' }}>Page {previewPage}</span>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          disabled={previewPage * 10 >= previewTotal}
                          onClick={() => setPreviewPage(prev => prev + 1)}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ height: '400px', display: 'flex', flexDir: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center' }}>
              <Database size={48} style={{ color: 'var(--text-muted)' }} />
              <h3>Select a Dataset</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '300px' }}>
                Upload a new dataset file or select one from the history panel to start visualize your data.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Upload;
