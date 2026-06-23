import React, { useState, useRef, useCallback } from 'react';
import api from '../api';
import Button from './ui/Button';
import { useToast } from '../hooks/useToast';

const CATEGORIES = ['Housing', 'Groceries', 'Transport', 'Dining out', 'Utilities', 'Subscriptions', 'Health', 'Entertainment', 'Education', 'Savings', 'Income', 'Other'];

export default function ImportModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('upload'); // upload | preview | success
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [columnMap, setColumnMap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [selectedRows, setSelectedRows] = useState({});
  const [selectAll, setSelectAll] = useState(true);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const { addToast } = useToast();

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setRows([]);
    setSummary(null);
    setColumnMap(null);
    setLoading(false);
    setError('');
    setImportResult(null);
    setSelectedRows({});
    setSelectAll(true);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = useCallback(async (selectedFile) => {
    if (!selectedFile) return;

    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload a CSV or Excel file (.csv, .xlsx, .xls).');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10MB.');
      return;
    }

    setFile(selectedFile);
    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { rows: parsedRows, summary: parsedSummary, columnMap: parsedMap } = res.data;
      setRows(parsedRows);
      setSummary(parsedSummary);
      setColumnMap(parsedMap);

      // Default selection
      const selections = {};
      parsedRows.forEach(r => {
        selections[r.id] = r.valid;
      });
      setSelectedRows(selections);
      setSelectAll(true);
      setStep('preview');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse file. Please check the format.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    handleFile(droppedFile);
  }, [handleFile]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileSelect = (e) => {
    handleFile(e.target.files[0]);
  };

  const toggleRow = (id) => {
    setSelectedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAll = () => {
    const newVal = !selectAll;
    setSelectAll(newVal);
    const selections = {};
    rows.forEach(r => {
      selections[r.id] = newVal && r.valid;
    });
    setSelectedRows(selections);
  };

  const updateRowCategory = (id, category) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, category } : r));
  };

  const removeRow = (id) => {
    setRows(prev => prev.filter(r => r.id !== id));
    setSelectedRows(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleImport = async () => {
    const confirmedRows = rows.filter(r => selectedRows[r.id]);
    if (confirmedRows.length === 0) {
      setError('No transactions selected for import.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/import/confirm', { rows: confirmedRows });
      setImportResult(res.data);
      setStep('success');
      addToast(`${res.data.imported} transactions imported`, 'success');
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to import transactions.');
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = rows.filter(r => selectedRows[r.id]).length;
  const validCount = rows.filter(r => r.valid).length;
  const totalAmount = rows
    .filter(r => selectedRows[r.id])
    .reduce((sum, r) => sum + (isNaN(r.amount) ? 0 : r.amount), 0);
  const currentMonth = new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors z-10"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 pt-6 pb-4">
          {['upload', 'preview', 'success'].map((s, i) => (
            <React.Fragment key={s}>
              <div
                className="flex items-center gap-2"
                style={{
                  color: step === s ? 'var(--accent-green)' : step === 'success' && s === 'upload' ? 'var(--accent-green)' : 'var(--text-secondary)',
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: step === s || (step === 'success' && i <= 1) ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                    color: step === s || (step === 'success' && i <= 1) ? '#0D0F14' : 'var(--text-secondary)',
                  }}
                >
                  {step === 'success' && i <= 1 ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i + 1}
                </div>
                <span className="text-xs font-medium hidden sm:inline">
                  {s === 'upload' ? 'Upload' : s === 'preview' ? 'Review' : 'Complete'}
                </span>
              </div>
              {i < 2 && <div className="flex-1 h-px" style={{ backgroundColor: step === 'success' ? 'var(--accent-green)' : 'var(--border)' }} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="p-6 pt-2">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Import transactions</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">Upload a CSV or Excel file from your bank to auto-import transactions.</p>

            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--accent-red)/10', border: '1px solid var(--accent-red)/20', color: 'var(--accent-red)' }}>
                {error}
              </div>
            )}

            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="relative flex flex-col items-center justify-center p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-colors hover:border-[var(--accent-green)]"
              style={{ borderColor: 'var(--border)', minHeight: 200 }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />

              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }} />
                  <p className="text-sm text-[var(--text-secondary)]">Parsing file...</p>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--accent-green)' + '15' }}>
                    <svg className="w-7 h-7" style={{ color: 'var(--accent-green)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                    Drop your CSV or Excel file here
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mb-4">or click to browse</p>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-tertiary)' }}>.csv</span>
                    <span className="px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-tertiary)' }}>.xlsx</span>
                    <span className="px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-tertiary)' }}>.xls</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-3 opacity-60">
                    Supports Capitec, FNB, Standard Bank & Nedbank statements
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="p-6 pt-2">
            {/* Detected bank + column mapping */}
            {summary && (
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--accent-green)' + '15', color: 'var(--accent-green)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Detected: {summary.detectedBank} statement
                </span>
                {columnMap && (
                  <span className="text-xs text-[var(--text-secondary)]">
                    Date → {columnMap.date || '?'} &nbsp;|&nbsp; Description → {columnMap.name || '?'} &nbsp;|&nbsp; Amount → {columnMap.amount || '?'}
                  </span>
                )}
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--accent-red)/10', border: '1px solid var(--accent-red)/20', color: 'var(--accent-red)' }}>
                {error}
              </div>
            )}

            {/* Summary bar */}
            <div className="flex items-center justify-between p-3 rounded-xl mb-4" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-[var(--text-primary)] font-medium">{selectedCount} selected</span>
                <span className="text-[var(--text-secondary)]">·</span>
                <span style={{ color: 'var(--accent-green)' }}>{validCount} valid</span>
                <span className="text-[var(--text-secondary)]">·</span>
                <span style={{ color: 'var(--accent-red)' }}>{summary?.invalid || 0} with errors</span>
                <span className="text-[var(--text-secondary)]">·</span>
                <span className="text-[var(--text-primary)] font-medium tabular-nums">
                  R{Math.abs(totalAmount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="text-xs font-medium px-2 py-1 rounded-lg transition-colors"
                  style={{ color: 'var(--accent-green)', backgroundColor: 'var(--accent-green)' + '10' }}
                >
                  {selectAll ? 'Deselect all' : 'Select all'}
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 600 }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <th className="p-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider w-10">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={toggleSelectAll}
                        className="rounded"
                        style={{ accentColor: 'var(--accent-green)' }}
                      />
                    </th>
                    <th className="p-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Date</th>
                    <th className="p-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Description</th>
                    <th className="p-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Amount</th>
                    <th className="p-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Category</th>
                    <th className="p-3 text-center text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {rows.map((row) => {
                    const isSelected = selectedRows[row.id];
                    const isInvalid = !row.valid;
                    return (
                      <tr
                        key={row.id}
                        style={{
                          backgroundColor: isInvalid ? 'rgba(255,92,92,0.06)' : isSelected ? 'var(--bg-primary)' : 'transparent',
                          opacity: isSelected ? 1 : 0.5,
                        }}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={!!isSelected}
                            onChange={() => toggleRow(row.id)}
                            disabled={isInvalid}
                            className="rounded"
                            style={{ accentColor: 'var(--accent-green)' }}
                          />
                        </td>
                        <td className="p-3 text-[var(--text-primary)] font-mono text-xs">{row.date || '—'}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--text-primary)] text-sm">{row.name || '—'}</span>
                            {row.error && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: 'var(--accent-red)' + '15', color: 'var(--accent-red)' }}>
                                {row.error}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={`text-sm font-semibold tabular-nums ${row.amount >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--text-primary)]'}`}
                          >
                            {row.amount >= 0 ? '+' : ''}R{Math.abs(row.amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="p-3">
                          <select
                            value={row.category}
                            onChange={(e) => updateRowCategory(row.id, e.target.value)}
                            className="text-xs px-2 py-1 rounded-lg border outline-none transition-colors"
                            style={{
                              backgroundColor: 'var(--bg-tertiary)',
                              borderColor: 'var(--border)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {CATEGORIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => removeRow(row.id)}
                            className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            aria-label="Remove row"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <Button variant="secondary" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={loading || selectedCount === 0}>
                {loading ? 'Importing...' : `Import ${selectedCount} transaction${selectedCount !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && importResult && (
          <div className="p-6 pt-2 flex flex-col items-center py-12">
            {/* Green checkmark animation */}
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: 'var(--accent-green)' + '15' }}>
              <svg className="w-10 h-10" style={{ color: 'var(--accent-green)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Successfully imported {importResult.imported} transaction{importResult.imported !== 1 ? 's' : ''}
            </h2>

            {importResult.skipped > 0 && (
              <p className="text-sm text-[var(--text-secondary)] mb-1">
                {importResult.skipped} duplicate{importResult.skipped !== 1 ? 's' : ''} skipped
              </p>
            )}

            <div className="flex items-center gap-1 text-sm mb-8" style={{ color: 'var(--accent-green)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>R{Math.abs(totalAmount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} added to {currentMonth}</span>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => { handleClose(); window.location.href = '/transactions'; }}>
                View transactions
              </Button>
              <Button variant="secondary" onClick={() => reset()}>
                Import another file
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}