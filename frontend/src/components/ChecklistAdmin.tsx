import React, { useState } from 'react';
import {
  type ChecklistItem,
  getChecklistItems,
  saveChecklistItems,
  resetChecklistToDefaults,
  generateAgentPrompt
} from '../config/checklistConfig';

const ChecklistAdmin: React.FC = () => {
  const [items, setItems] = useState<ChecklistItem[]>(getChecklistItems());
  const [showPrompt, setShowPrompt] = useState(false);

  const handleSave = () => {
    saveChecklistItems(items);
    alert('Checklist saved successfully!');
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset to default checklist? This cannot be undone.')) {
      resetChecklistToDefaults();
      setItems(getChecklistItems());
      alert('Checklist reset to defaults!');
    }
  };

  const handleAddItem = () => {
    const newItem: ChecklistItem = {
      id: `custom_${Date.now()}`,
      question: 'New question',
      keywords: ['keyword1', 'keyword2'],
      required: false,
      order: items.length + 1,
      category: 'general'
    };
    setItems([...items, newItem]);
  };

  const handleDeleteItem = (id: string) => {
    if (confirm('Delete this checklist item?')) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleUpdateItem = (id: string, updates: Partial<ChecklistItem>) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return;

    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];

    // Update order numbers
    newItems.forEach((item, idx) => {
      item.order = idx + 1;
    });

    setItems(newItems);
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="glass-gold border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-display font-bold text-white">Checklist Administration</h1>
              <p className="text-gray-400 text-sm mt-1">Configure daily report interview questions</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                className="px-4 py-2 glass rounded-xl text-white hover:bg-white/10 transition text-sm font-medium"
              >
                {showPrompt ? 'Hide' : 'View'} Agent Prompt
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 glass rounded-xl text-white hover:bg-white/10 transition text-sm font-medium"
              >
                Reset to Defaults
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-gold text-dark-bg rounded-xl hover:bg-gold-light transition text-sm font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Agent Prompt Preview */}
        {showPrompt && (
          <div className="mb-6 glass-gold rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Generated Agent Prompt</h2>
            <pre className="text-sm text-gray-300 whitespace-pre-wrap bg-black/30 p-4 rounded-lg overflow-x-auto">
              {generateAgentPrompt(items)}
            </pre>
            <p className="text-xs text-gray-500 mt-2">
              This prompt would be sent to ElevenLabs to update Roxy's interview script.
              Note: Updating the agent prompt requires ElevenLabs API integration.
            </p>
          </div>
        )}

        {/* Add New Item Button */}
        <div className="mb-6">
          <button
            onClick={handleAddItem}
            className="px-6 py-3 bg-gold text-dark-bg rounded-xl hover:bg-gold-light transition font-semibold"
          >
            + Add Checklist Item
          </button>
        </div>

        {/* Checklist Items */}
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="glass rounded-2xl p-6">
              <div className="flex items-start gap-4">
                {/* Order Controls */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveItem(item.id, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▲
                  </button>
                  <span className="text-sm text-gray-500 text-center">{item.order}</span>
                  <button
                    onClick={() => moveItem(item.id, 'down')}
                    disabled={index === items.length - 1}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▼
                  </button>
                </div>

                {/* Item Content */}
                <div className="flex-1 space-y-4">
                  {/* Question */}
                  <div>
                    <label className="text-sm font-medium text-gray-400 block mb-2">Question</label>
                    <input
                      type="text"
                      value={item.question}
                      onChange={(e) => handleUpdateItem(item.id, { question: e.target.value })}
                      className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-gold focus:outline-none"
                    />
                  </div>

                  {/* Keywords */}
                  <div>
                    <label className="text-sm font-medium text-gray-400 block mb-2">
                      Keywords (comma-separated) - used to auto-check this item during conversation
                    </label>
                    <input
                      type="text"
                      value={item.keywords.join(', ')}
                      onChange={(e) => handleUpdateItem(item.id, {
                        keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
                      })}
                      className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:border-gold focus:outline-none"
                      placeholder="arrival time, got to site, started work"
                    />
                  </div>

                  {/* Settings Row */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.required}
                        onChange={(e) => handleUpdateItem(item.id, { required: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-300">Required</span>
                    </label>

                    <select
                      value={item.category || 'general'}
                      onChange={(e) => handleUpdateItem(item.id, { category: e.target.value as any })}
                      className="px-3 py-1 bg-black/30 border border-white/10 rounded text-sm text-white focus:border-gold focus:outline-none"
                    >
                      <option value="time">Time</option>
                      <option value="personnel">Personnel</option>
                      <option value="materials">Materials</option>
                      <option value="safety">Safety</option>
                      <option value="general">General</option>
                    </select>

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="ml-auto px-4 py-2 text-red-400 hover:text-red-300 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Help Text */}
        <div className="mt-8 glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-3">How it works</h3>
          <ul className="text-sm text-gray-400 space-y-2">
            <li>• Questions are asked by Roxy during the voice interview in the order shown</li>
            <li>• Keywords help automatically check off items as they're discussed</li>
            <li>• Required items must be covered before the interview is considered complete</li>
            <li>• Changes are saved locally and take effect immediately for new reports</li>
            <li>• To update Roxy's actual interview script in ElevenLabs, you'll need to configure the agent's prompt manually or use the API</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default ChecklistAdmin;
