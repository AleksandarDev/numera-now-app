'use client';

import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';

export function MigrationIndicator() {
    const [isDismissed, setIsDismissed] = useState(false);

    if (isDismissed) {
        return null;
    }

    return (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
                    Dashboard Upgrade Available
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                    Your dashboard contains legacy widgets. Update to the new
                    modular widgets for better flexibility and control.
                </p>
            </div>
            <button
                type="button"
                onClick={() => setIsDismissed(true)}
                className="flex-shrink-0 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                aria-label="Dismiss"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
