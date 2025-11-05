import React, { useState } from 'react';

interface MetricTooltipProps {
  title: string;
  children: React.ReactNode;
  explanation: string;
  calculation?: string;
  goodRange?: string;
  source?: string;
}

const MetricTooltip: React.FC<MetricTooltipProps> = ({
  title,
  children,
  explanation,
  calculation,
  goodRange,
  source
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Metric Display */}
      <div className="relative">
        {children}

        {/* Info Icon */}
        <button
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          onClick={() => setIsOpen(!isOpen)}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 transition flex items-center justify-center"
        >
          <svg className="w-3 h-3 text-gold" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Tooltip Popup */}
      {isOpen && (
        <div className="absolute z-50 w-80 p-4 bg-dark-bg border border-gold/30 rounded-xl shadow-2xl -right-2 top-full mt-2">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center space-x-2 pb-2 border-b border-white/10">
              <svg className="w-5 h-5 text-gold flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <h4 className="text-white font-semibold text-sm">{title}</h4>
            </div>

            {/* Explanation */}
            <div>
              <p className="text-gray-300 text-xs leading-relaxed">{explanation}</p>
            </div>

            {/* Calculation */}
            {calculation && (
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-xs text-gray-400 mb-1 font-semibold">How it's calculated:</p>
                <p className="text-xs text-white font-mono">{calculation}</p>
              </div>
            )}

            {/* Good Range */}
            {goodRange && (
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-xs text-gray-400 font-semibold">Target range:</p>
                  <p className="text-xs text-white">{goodRange}</p>
                </div>
              </div>
            )}

            {/* Data Source */}
            {source && (
              <div className="text-xs text-gray-500 pt-2 border-t border-white/10">
                Data source: {source}
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="absolute -top-2 right-4 w-4 h-4 bg-dark-bg border-l border-t border-gold/30 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};

export default MetricTooltip;
