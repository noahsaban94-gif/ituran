import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          dir="rtl"
          className="my-4 p-5 rounded-3xl border border-destructive/30 bg-destructive/5 text-card-foreground shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/15 text-destructive font-bold text-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-foreground">
                {this.props.fallbackTitle || "שגיאה בטעינת הרכיב"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {this.state.error?.message || "אירעה שגיאה בלתי צפויה ברכיב זה"}
              </p>
            </div>
            <button
              onClick={this.resetError}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-2xl border bg-card hover:bg-muted text-foreground transition shadow-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>נסה שוב</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
