import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturó una excepción no controlada:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 text-brand-text">
          <div className="card-surface max-w-lg w-full p-8 text-center space-y-6 shadow-xl border border-brand-border">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-accent/15 text-brand-accent">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h1 className="font-serif text-2xl font-bold">Ha ocurrido una interrupción inesperada</h1>
              <p className="text-xs text-brand-text/70">
                Se detectó un conflicto de datos durante el renderizado. La aplicación evitó que el navegador se congele.
              </p>
              {this.state.error && (
                <div className="mt-3 rounded-lg bg-black/40 p-3 text-left font-mono text-[11px] text-red-300 break-all border border-red-500/20">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="btn-primary flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Recargar página
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="btn-secondary flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Home className="h-4 w-4" />
                Ir al Inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

