import { Component } from 'react';
import { TriangleAlert } from 'lucide-react';
import { translate } from '../../lib/i18n.jsx';
import { en } from '../../lib/en.js';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Screen crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-md py-16 text-center">
        <TriangleAlert className="mx-auto h-10 w-10 text-brand-ink" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-bold">{translate(en, 'errors.crashTitle')}</h2>
        <p className="mt-2 text-ink-muted">{translate(en, 'errors.crashBody')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 h-12 rounded-control bg-brand px-5 font-semibold text-ink"
        >
          {translate(en, 'errors.reload')}
        </button>
      </div>
    );
  }
}
