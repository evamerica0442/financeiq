import React from 'react';

/**
 * ErrorBoundary — catches uncaught render errors and shows a fallback UI
 * instead of letting React unmount the entire tree (blank white page).
 * Wraps the entire App as well as individual page-level routes.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      // If this is a fallback render (no custom fallback provided)
      if (this.props.fallbackRender) {
        return this.props.fallbackRender({
          error: this.state.error,
          resetErrorBoundary: this.handleReset,
        });
      }

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
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
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
              margin: '0 0 24px',
              lineHeight: 1.5,
            }}>
              An unexpected error occurred. Please try refreshing the page.
              {this.state.error?.message && (
                <>
                  <br />
                  <code style={{
                    display: 'inline-block',
                    marginTop: 8,
                    padding: '4px 8px',
                    fontSize: '11px',
                    background: 'var(--bg-tertiary, #1E2330)',
                    borderRadius: 6,
                    color: 'var(--accent-red, #FF5C5C)',
                  }}>
                    {this.state.error.message}
                  </code>
                </>
              )}
            </p>
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