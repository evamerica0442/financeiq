import React from 'react';

/**
 * ErrorBoundary — catches uncaught render errors and shows a fallback UI
 * instead of letting React unmount the entire tree (blank white page).
 * Wraps the entire App as well as individual page-level routes.
 *
 * Auto-retry: by default the boundary will automatically attempt recovery
 * after 5 seconds. This helps recover from transient errors (e.g. state
 * desync after delete) without requiring user interaction. Pass
 * autoRetry={false} to disable auto-recovery.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    this.retryTimer = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught:', error, errorInfo);
    this.setState({ errorInfo });

    // Auto-retry after 5 seconds if autoRetry prop is set (default: true)
    if (this.props.autoRetry !== false) {
      this.retryTimer = setTimeout(() => {
        this.handleReset();
      }, 5000);
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }

  handleReset = () => {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackRender) {
        return this.props.fallbackRender({
          error: this.state.error,
          resetErrorBoundary: this.handleReset,
        });
      }

      // Extract a human-readable message from the error
      const errorMsg = this.state.error?.message || 'Unknown error';
      // Hide full technical error in production-like mode unless explicitly shown
      const showTechnical = this.props.showTechnical || process.env.NODE_ENV === 'development';

      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '40px 20px',
          background: 'var(--bg-primary, #0D0F14)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{ fontSize: '64px', marginBottom: '16px', lineHeight: 1 }}>⚠️</div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: 'var(--text-primary, #F0F2F7)',
              margin: '0 0 8px',
            }}>
              Something went wrong
            </h2>
            <p style={{
              fontSize: '14px',
              color: 'var(--text-secondary, #8B92A5)',
              margin: '0 0 6px',
              lineHeight: 1.5,
            }}>
              An unexpected error occurred.
            </p>
            {this.props.autoRetry !== false && (
              <p style={{
                fontSize: '12px',
                color: 'var(--text-secondary, #8B92A5)',
                margin: '0 0 24px',
              }}>
                Auto-recovering in 5 seconds...
              </p>
            )}
            {showTechnical && (
              <p style={{
                fontSize: '12px',
                color: 'var(--text-secondary, #8B92A5)',
                margin: '0 0 24px',
              }}>
                <code style={{
                  display: 'inline-block',
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: 'var(--bg-tertiary, #1E2330)',
                  borderRadius: 6,
                  color: 'var(--accent-red, #FF5C5C)',
                }}>
                  {errorMsg}
                </code>
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '10px 24px',
                  borderRadius: 12,
                  border: '1px solid var(--border, #2A2F3E)',
                  background: 'var(--bg-secondary, #161A23)',
                  color: 'var(--text-primary, #F0F2F7)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 24px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#00C896',
                  color: '#0D0F14',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Refresh page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
