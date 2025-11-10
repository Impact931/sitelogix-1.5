import React, { useMemo } from 'react';
import type { ChecklistItem as ConfigChecklistItem } from '../config/checklistConfig';

interface ChecklistSection {
  title: string;
  items: Array<ConfigChecklistItem & { isCompleted: boolean; index: number }>;
}

interface DailyReportChecklistProps {
  items: ConfigChecklistItem[];
  completedItemIds?: Set<number>;
  onToggleItem?: (itemIndex: number, completed: boolean) => void;
  compact?: boolean;
}

const DailyReportChecklist: React.FC<DailyReportChecklistProps> = ({
  items,
  completedItemIds = new Set(),
  onToggleItem,
  compact = false
}) => {
  // Create sections based on item order (first 5 are Admin, next 3 are Materials, etc.)
  const sections: ChecklistSection[] = useMemo(() => {
    const getSectionForIndex = (index: number): string => {
      if (index < 5) return 'Admin';
      if (index < 8) return 'Materials';
      if (index < 11) return 'Off-Site';
      return 'General';
    };

    const sectionMap: { [key: string]: Array<ConfigChecklistItem & { isCompleted: boolean; index: number }> } = {};

    items.forEach((item, index) => {
      const section = getSectionForIndex(index);
      if (!sectionMap[section]) {
        sectionMap[section] = [];
      }
      sectionMap[section].push({
        ...item,
        isCompleted: completedItemIds.has(index),
        index
      });
    });

    return ['Admin', 'Materials', 'Off-Site', 'General']
      .filter(title => sectionMap[title])
      .map(title => ({
        title,
        items: sectionMap[title]
      }));
  }, [items, completedItemIds]);

  const handleToggleItem = (itemIndex: number) => {
    const isCurrentlyCompleted = completedItemIds.has(itemIndex);
    if (onToggleItem) {
      onToggleItem(itemIndex, !isCurrentlyCompleted);
    }
  };

  const getCompletionStats = () => {
    const requiredItems = items.filter(item => item.required);
    const completedRequired = requiredItems.filter((_, index) => completedItemIds.has(index) && items[index].required).length;
    const totalRequired = requiredItems.length;

    const optionalItems = items.filter(item => !item.required);
    const completedOptional = optionalItems.filter((_, index) => completedItemIds.has(index) && !items[index].required).length;
    const totalOptional = optionalItems.length;

    return { completedRequired, totalRequired, completedOptional, totalOptional };
  };

  const stats = getCompletionStats();

  if (compact) {
    return (
      <div className="glass rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Daily Report Checklist</h3>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400">
              Required: {stats.completedRequired}/{stats.totalRequired}
            </span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-400">
              Optional: {stats.completedOptional}/{stats.totalOptional}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {sections.map(section => (
            <div key={section.title} className="space-y-1">
              <h4 className="text-xs font-semibold text-gray-400 mb-1">{section.title}</h4>
              {section.items.map(item => (
                <label
                  key={item.id}
                  className="flex items-center space-x-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    onChange={() => handleToggleItem(item.index)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-gold focus:ring-2 focus:ring-gold focus:ring-offset-0"
                  />
                  <span className={`text-xs ${item.isCompleted ? 'text-gray-500 line-through' : 'text-gray-300'} group-hover:text-white transition`}>
                    {item.question}
                    {item.required && <span className="text-red-400 ml-1">*</span>}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>

        {stats.completedRequired === stats.totalRequired && (
          <div className="mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-xs text-green-400 font-medium text-center">
              ✓ All required items completed
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-white mb-1">Daily Report Checklist</h2>
          <p className="text-sm text-gray-400">Track your daily report topics with Roxy</p>
        </div>
        <div className="text-right">
          <div className="flex items-center space-x-3">
            <div>
              <p className="text-sm text-gray-400">Required</p>
              <p className="text-lg font-bold text-white">
                {stats.completedRequired}/{stats.totalRequired}
              </p>
            </div>
            <div className="h-10 w-px bg-white/10"></div>
            <div>
              <p className="text-sm text-gray-400">Optional</p>
              <p className="text-lg font-bold text-white">
                {stats.completedOptional}/{stats.totalOptional}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section, sectionIndex) => (
          <div key={section.title} className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                <span className="text-sm font-bold text-gold">{sectionIndex + 1}</span>
              </div>
              <h3 className="text-lg font-semibold text-white">{section.title}</h3>
            </div>

            <div className="ml-11 space-y-2">
              {section.items.map(item => (
                <label
                  key={item.id}
                  className="flex items-start space-x-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition group"
                >
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    onChange={() => handleToggleItem(item.index)}
                    className="mt-1 w-5 h-5 rounded border-white/20 bg-white/5 text-gold focus:ring-2 focus:ring-gold focus:ring-offset-0"
                  />
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${item.isCompleted ? 'text-gray-500 line-through' : 'text-white'} group-hover:text-gold transition`}>
                      {item.question}
                      {item.required && <span className="text-red-400 ml-1">*</span>}
                    </span>
                    {!item.required && (
                      <span className="ml-2 text-xs text-gray-500">(Optional - NSTR allowed)</span>
                    )}
                  </div>
                  {item.isCompleted && (
                    <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {stats.completedRequired === stats.totalRequired && (
        <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-green-400">All Required Items Completed</p>
              <p className="text-xs text-green-300/70 mt-0.5">Your daily report covers all mandatory topics</p>
            </div>
          </div>
        </div>
      )}

      {stats.completedRequired < stats.totalRequired && (
        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-yellow-400">
                {stats.totalRequired - stats.completedRequired} Required Item{stats.totalRequired - stats.completedRequired !== 1 ? 's' : ''} Remaining
              </p>
              <p className="text-xs text-yellow-300/70 mt-0.5">Complete all required items before finishing your report</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReportChecklist;
