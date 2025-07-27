"use client";

import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function DefaultErrorFallback({ error }: { error: Error }) {
  return (
    <div className="error-boundary bg-red-50 border border-red-200 rounded-lg p-4 m-4">
      <h2 className="text-red-800 font-semibold mb-2">Something went wrong</h2>
      <details className="text-red-600 text-sm">
        <summary className="cursor-pointer">Error details</summary>
        <pre className="mt-2 text-xs overflow-auto">{error.message}</pre>
      </details>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }
      return <DefaultErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}