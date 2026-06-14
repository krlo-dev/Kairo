import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Sentry } from '../lib/sentry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="max-w-md text-center">
            <h1 className="text-kairo-h2 text-kairo-amber">Algo salió mal</h1>
            <p className="mt-4 text-kairo-body text-neutral-600">
              Ocurrió un error inesperado. El equipo fue notificado.
            </p>
            <button
              type="button"
              className="btn-primary mt-6"
              onClick={() => window.location.reload()}
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
