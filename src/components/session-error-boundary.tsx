'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SessionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-8">
            <div className="max-w-md text-center space-y-4">
              <div className="text-4xl">⚠️</div>
              <h1 className="text-2xl font-bold">Session Error</h1>
              <p className="text-zinc-400">
                {this.state.error?.message ?? 'Something went wrong during the exercise session.'}
              </p>
              <button
                onClick={() => window.location.href = '/'}
                className="bg-blue-600 hover:bg-blue-500 text-white py-3 px-6 rounded-lg transition-colors"
              >
                Back to Exercises
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
