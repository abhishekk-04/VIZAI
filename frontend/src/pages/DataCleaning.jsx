import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { 
  Wand2, 
  Undo, 
  RotateCcw, 
  Trash2, 
  CornerDownRight, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Edit3,
  AlignLeft,
  ArrowRight,
  Database
} from 'lucide-react';

const DataCleaning = () => {
  const [activeDataset, setActiveDataset] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [error, setError] = useState('');
  
  // Cleaning form inputs
  const [selectedCol, setSelectedCol] = useState('');
  const [renameNewName, setRenameNewName] = useState('');
  const [fillMethod, setFillMethod] = useState('mean');
  const [fillCustomValue, setFillCustomValue] = useState('');
  const [convertTargetType, setConvertTargetType] = useState('Numerical');
  const [warningModal, setWarningModal] = useState(null);

  const navigate = useNavigate();

  const loadDataset = async () => {
    const datasetId = localStorage.getItem('activeDatasetId');
    if (!datasetId) return;
    try {
      const data = await api.get(`/datasets/${datasetId}`);
      setActiveDataset(data);
      if (data.columns_metadata && Object.keys(data.columns_metadata).length > 0) {
        setSelectedCol(Object.keys(data.columns_metadata)[0]);
      }
      fetchPreview(data.id);
    } catch (err) {
      console.error(err);
      setError('Failed to load dataset details.');
    }
  };

  const fetchPreview = async (datasetId) => {
    try {
      const res = await api.get(`/datasets/${datasetId}/preview?page=1&page_size=10`);
      setPreviewData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadDataset();
  }, []);

  useEffect(() => {
    if (activeDataset && selectedCol) {
      const colType = activeDataset.columns_metadata?.[selectedCol];
      if (colType !== 'Numerical Measure') {
        if (fillMethod === 'mean' || fillMethod === 'median') {
          setFillMethod('mode');
        }
      }
    }
  }, [selectedCol, activeDataset, fillMethod]);

  const handleCleanAction = async (action, params = {}) => {
    if (!activeDataset) return;
    setError('');

    if (action === 'fill_missing') {
      const col = params.column;
      const method = params.method;
      const colType = activeDataset.columns_metadata?.[col];
      
      if (colType !== 'Numerical Measure' && (method === 'mean' || method === 'median')) {
        setWarningModal({
          title: 'Invalid Imputation Method',
          message: `The selected column is categorical, so the ${method === 'mean' ? 'Mean' : 'Median'} imputation method cannot be applied.`,
          reason: 'Median and Mean require numeric values because they are mathematical statistics. Categorical data (such as State, Country, Gender, Product Line, etc.) contains labels rather than numbers, so these methods are not statistically valid.',
          suggestion: '• Mode (Recommended)\n• Custom Value'
        });
        return;
      }
    }

    setCleaning(true);
    try {
      const res = await api.post(`/datasets/${activeDataset.id}/clean`, {
        action,
        params
      });
      // Update local state
      setActiveDataset(prev => ({
        ...prev,
        cleaning_history: res.cleaning_history,
        columns_metadata: res.columns_metadata,
        summary_stats: res.summary_stats
      }));
      fetchPreview(activeDataset.id);
      
      // Reset inputs
      setRenameNewName('');
      setFillCustomValue('');
    } catch (err) {
      setError(err.message || 'Cleaning action failed.');
    } finally {
      setCleaning(false);
    }
  };

  const handleUndo = async () => {
    if (!activeDataset || !activeDataset.cleaning_history?.length) return;
    setError('');
    setCleaning(true);
    try {
      const res = await api.post(`/datasets/${activeDataset.id}/undo`);
      setActiveDataset(prev => ({
        ...prev,
        cleaning_history: res.cleaning_history,
        columns_metadata: res.columns_metadata,
        summary_stats: res.summary_stats
      }));
      fetchPreview(activeDataset.id);
    } catch (err) {
      setError(err.message || 'Failed to undo action.');
    } finally {
      setCleaning(false);
    }
  };

  const handleReset = async () => {
    if (!activeDataset) return;
    if (!confirm('Are you sure you want to reset the dataset to its original, uncleaned state? This will clear your entire history.')) return;
    setError('');
    setCleaning(true);
    try {
      const res = await api.post(`/datasets/${activeDataset.id}/reset`);
      setActiveDataset(prev => ({
        ...prev,
        cleaning_history: res.cleaning_history,
        columns_metadata: res.columns_metadata,
        summary_stats: res.summary_stats
      }));
      fetchPreview(activeDataset.id);
    } catch (err) {
      setError(err.message || 'Failed to reset dataset.');
    } finally {
      setCleaning(false);
    }
  };

  const getFriendlyHistoryText = (step) => {
    const act = step.action;
    const p = step.params;
    switch(act) {
      case 'remove_duplicates': return 'Removed all duplicate rows';
      case 'drop_column': return `Dropped column '${p.column}'`;
      case 'rename_column': return `Renamed column '${p.column}' to '${p.new_name}'`;
      case 'trim_spaces': return `Trimmed whitespace in '${p.column}'`;
      case 'delete_nulls': return p.column ? `Deleted rows with nulls in '${p.column}'` : 'Deleted rows containing any null cell';
      case 'fill_missing': return `Filled nulls in '${p.column}' using ${p.method} ${p.value ? `('${p.value}')` : ''}`;
      case 'convert_type': return `Converted column '${p.column}' type to ${p.to_type}`;
      default: return `Executed ${act}`;
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Cleaning Studio</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Format, structure, and clean your data before building visualizations</p>
        </div>
        
        {activeDataset && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleUndo} 
              disabled={cleaning || !activeDataset.cleaning_history?.length}
              title="Undo last step"
            >
              <Undo size={18} />
              <span>Undo</span>
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={handleReset} 
              disabled={cleaning || !activeDataset.cleaning_history?.length}
              title="Reset dataset"
            >
              <RotateCcw size={18} />
              <span>Reset</span>
            </button>
            <button 
              className="btn btn-primary animate-fade-in" 
              onClick={() => navigate('/studio')}
            >
              <span>Viz Studio</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="insight-item danger" style={{ marginBottom: '24px' }}>
          <div className="insight-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>Operation Failed</span>
          </div>
          <div className="insight-message">{error}</div>
        </div>
      )}

      {!activeDataset ? (
        <div className="glass-panel" style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center' }}>
          <Database size={48} style={{ color: 'var(--text-muted)' }} />
          <h3>No Active Dataset</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '300px' }}>
            Please upload a dataset first in the Dataset Workspace before using the Data Cleaning module.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/upload')}>
            <span>Go to Upload</span>
          </button>
        </div>
      ) : (
        <div className="split-workspace">
          {/* Left panel: cleaning operations toolbox */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-panel" style={{ position: 'relative' }}>
              {cleaning && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10
                }}>
                  <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
                </div>
              )}
              
              <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wand2 size={20} style={{ color: 'var(--primary)' }} />
                <span>Cleaning Operations</span>
              </h3>

              {/* Column selector */}
              <div className="form-group">
                <label className="form-label" htmlFor="clean-column">Select Column to Clean</label>
                <select 
                  id="clean-column" 
                  className="form-input form-select"
                  value={selectedCol}
                  onChange={(e) => setSelectedCol(e.target.value)}
                >
                  {activeDataset.columns_metadata && Object.keys(activeDataset.columns_metadata).map(col => (
                    <option key={col} value={col}>{col} ({activeDataset.columns_metadata[col]})</option>
                  ))}
                </select>
              </div>

              {/* Operations options list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--surface-border)', paddingTop: '20px' }}>
                {/* 1. Remove duplicates */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Global Operations</h4>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => handleCleanAction('remove_duplicates')}
                  >
                    <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                    <span>Remove Duplicate Rows</span>
                  </button>
                </div>

                {/* 2. Column manipulations */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--surface-border)', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '0.9rem' }}>Column Manipulations</h4>
                  
                  {/* Rename */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="New column name" 
                        value={renameNewName}
                        onChange={(e) => setRenameNewName(e.target.value)}
                      />
                      <button 
                        className="btn btn-secondary btn-icon"
                        onClick={() => handleCleanAction('rename_column', { column: selectedCol, new_name: renameNewName })}
                        disabled={!renameNewName}
                      >
                        <Edit3 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Drop column */}
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => handleCleanAction('drop_column', { column: selectedCol })}
                  >
                    <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                    <span>Drop Selected Column</span>
                  </button>

                  {/* Trim spacing */}
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => handleCleanAction('trim_spaces', { column: selectedCol })}
                  >
                    <AlignLeft size={16} />
                    <span>Trim Whitespace Spaces</span>
                  </button>
                </div>

                {/* 3. Handle Null Values */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--surface-border)', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '0.9rem' }}>Null & Missing Values</h4>

                  {/* Delete rows with null */}
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => handleCleanAction('delete_nulls', { column: selectedCol })}
                  >
                    <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                    <span>Delete Rows with Nulls</span>
                  </button>

                  {/* Fill missing values */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', margin: 0 }}>Fill Nulls Using:</label>
                    <select 
                      className="form-input form-select"
                      style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                      value={fillMethod}
                      onChange={(e) => setFillMethod(e.target.value)}
                    >
                      {activeDataset?.columns_metadata?.[selectedCol] === 'Numerical Measure' && (
                        <>
                          <option value="mean">Mean (Average)</option>
                          <option value="median">Median</option>
                        </>
                      )}
                      <option value="mode">Mode (Most Common)</option>
                      <option value="value">Constant Value</option>
                    </select>
                    {fillMethod === 'value' && (
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                        placeholder="Constant filler value"
                        value={fillCustomValue}
                        onChange={(e) => setFillCustomValue(e.target.value)}
                      />
                    )}
                    <button 
                      className="btn btn-secondary"
                      onClick={() => handleCleanAction('fill_missing', { 
                        column: selectedCol, 
                        method: fillMethod, 
                        value: fillMethod === 'value' ? fillCustomValue : null 
                      })}
                      disabled={fillMethod === 'value' && !fillCustomValue}
                    >
                      Fill Missing Cells
                    </button>
                  </div>
                </div>

                {/* 4. Convert Data Types */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--surface-border)', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '0.9rem' }}>Convert Data Type</h4>
                  <select 
                    className="form-input form-select"
                    style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                    value={convertTargetType}
                    onChange={(e) => setConvertTargetType(e.target.value)}
                  >
                    <option value="Numerical">Numerical</option>
                    <option value="Categorical">Categorical</option>
                    <option value="Date/Time">Date/Time</option>
                    <option value="Boolean">Boolean</option>
                    <option value="Text">Text</option>
                  </select>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleCleanAction('convert_type', { column: selectedCol, to_type: convertTargetType })}
                  >
                    Change Type Classification
                  </button>
                </div>
              </div>
            </div>

            {/* History stack */}
            <div className="glass-panel">
              <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>Cleaning History Log</h3>
              {(!activeDataset.cleaning_history || activeDataset.cleaning_history.length === 0) ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No steps taken yet. Original file remains unmodified.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeDataset.cleaning_history.map((step, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        fontSize: '0.82rem', 
                        color: 'var(--text-secondary)' 
                      }}
                    >
                      <CornerDownRight size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>Step {idx + 1}:</span>
                      <span>{getFriendlyHistoryText(step)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right panel: dataset statistics + clean grid preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
            {/* Stats summary */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '14px' }}>Active Dataset Stats</h3>
              <div className="grid-cards" style={{ margin: 0, gap: '16px' }}>
                <div style={{ borderLeft: '3px solid var(--primary)', paddingLeft: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ROWS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{activeDataset.summary_stats?.rows?.toLocaleString() || 0}</div>
                </div>
                <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>COLUMNS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{activeDataset.summary_stats?.columns || 0}</div>
                </div>
                <div style={{ borderLeft: '3px solid var(--warning)', paddingLeft: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>MISSING CELLS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{activeDataset.summary_stats?.missing_values?.toLocaleString() || 0}</div>
                </div>
                <div style={{ borderLeft: '3px solid var(--danger)', paddingLeft: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>DUPLICATES</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{activeDataset.summary_stats?.duplicate_rows?.toLocaleString() || 0}</div>
                </div>
              </div>
            </div>

            {/* Grid preview */}
            <div className="glass-panel">
              <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Clean Dataset Preview (First 10 rows)</h3>
              {previewData.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No rows to preview.</p>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {previewData.length > 0 && Object.keys(previewData[0]).map(key => (
                          <th key={key}>
                            <div>{key}</div>
                            <span 
                              className={`badge badge-${activeDataset.columns_metadata?.[key]?.toLowerCase().replace('/', '')}`}
                              style={{ fontSize: '0.65rem', padding: '2px 6px', marginTop: '4px' }}
                            >
                              {activeDataset.columns_metadata?.[key]}
                            </span>
                          </th>
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal Overlay */}
      {warningModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '500px',
            width: '90%',
            padding: '30px',
            border: '1px solid var(--surface-border)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', color: 'var(--warning)' }}>
              <AlertCircle size={28} />
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)' }}>{warningModal.title}</h2>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.92rem', color: 'var(--text)' }}>
              <p style={{ fontWeight: 650, lineHeight: 1.4 }}>{warningModal.message}</p>
              
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12.5px 16px', borderRadius: '8px', borderLeft: '3px solid var(--warning)' }}>
                <strong style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>Reason:</strong>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>{warningModal.reason}</p>
              </div>

              <div style={{ marginTop: '4px' }}>
                <strong style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '6px' }}>Please choose one of the following methods instead:</strong>
                {warningModal.suggestion.split('\n').map((line, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--accent)' }}>•</span>
                    <span>{line.replace('•', '').trim()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-primary" onClick={() => setWarningModal(null)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataCleaning;
