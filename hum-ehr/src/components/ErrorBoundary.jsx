import { Component } from 'react';
/**
 * Catches render-time errors in the subtree and shows a recoverable fallback
 * instead of unmounting the whole app to a blank screen. This is the one place
 * a class component is still required — React has no hook equivalent for error
 * boundaries.
 */
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('Unhandled UI error.', error, info);
    }
    handleReset = () => this.setState({ hasError: false, error: null });
    render() {
        if (!this.state.hasError)
            return this.props.children;
        if (this.props.fallback)
            return this.props.fallback;
        return (<div className="p-5 text-center">
            <h5 className="text-danger">Something went wrong.</h5>
            <p className="text-muted small mb-3">
                {this.state.error?.message || 'An unexpected error occurred while rendering this view.'}
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={this.handleReset}>
                Try again
            </button>
        </div>);
    }
}
export default ErrorBoundary;
