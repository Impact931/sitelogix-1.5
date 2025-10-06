import React from 'react';

interface Message {
  role: 'user' | 'agent';
  message: string;
  timestamp?: string;
}

interface TranscriptData {
  conversation_id: string;
  agent_id?: string;
  status?: string;
  transcript?: Message[];
  metadata?: any;
  analysis?: any;
}

interface TranscriptViewerProps {
  transcript: TranscriptData | null;
  onClose: () => void;
  conversationId: string;
  managerName?: string;
  projectName?: string;
  reportDate?: string;
}

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  transcript,
  onClose,
  conversationId,
  managerName,
  projectName,
  reportDate
}) => {
  if (!transcript) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="glass-gold rounded-2xl p-8 max-w-2xl w-full">
          <h2 className="text-2xl font-bold text-white mb-4">Transcript Not Available</h2>
          <p className="text-gray-400 mb-6">No transcript data found for this conversation.</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gold text-dark-bg rounded-xl hover:bg-gold-light transition font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const messages = transcript.transcript || [];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-gold rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-2">Conversation Transcript</h2>
              <div className="flex gap-4 text-sm text-gray-400">
                {managerName && <span>Manager: {managerName}</span>}
                {projectName && <span>• Project: {projectName}</span>}
                {reportDate && <span>• Date: {reportDate}</span>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition p-2"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Conversation Info */}
          <div className="flex gap-4 text-xs">
            <div className="glass rounded-lg px-3 py-2">
              <span className="text-gray-500">Conversation ID:</span>
              <span className="ml-2 text-gray-300 font-mono">{conversationId}</span>
            </div>
            <div className="glass rounded-lg px-3 py-2">
              <span className="text-gray-500">Messages:</span>
              <span className="ml-2 text-white font-semibold">{messages.length}</span>
            </div>
            {transcript.status && (
              <div className="glass rounded-lg px-3 py-2">
                <span className="text-gray-500">Status:</span>
                <span className="ml-2 text-green-400 font-semibold">{transcript.status}</span>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <p>No messages in this conversation yet.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-6 py-4 ${
                    msg.role === 'user'
                      ? 'bg-gold text-dark-bg ml-auto'
                      : 'glass text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold opacity-70">
                      {msg.role === 'user' ? managerName || 'User' : 'Roxy'}
                    </span>
                    {msg.timestamp && (
                      <span className="text-xs opacity-50">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={() => {
              const text = messages
                .map(m => `${m.role === 'user' ? managerName || 'User' : 'Roxy'}: ${m.message}`)
                .join('\n\n');
              navigator.clipboard.writeText(text);
              alert('Transcript copied to clipboard!');
            }}
            className="px-6 py-2 glass rounded-xl text-white hover:bg-white/10 transition text-sm font-medium"
          >
            Copy to Clipboard
          </button>
          <button
            onClick={() => {
              const blob = new Blob(
                [JSON.stringify(transcript, null, 2)],
                { type: 'application/json' }
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `transcript_${conversationId}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-6 py-2 glass rounded-xl text-white hover:bg-white/10 transition text-sm font-medium"
          >
            Download JSON
          </button>
          <button
            onClick={onClose}
            className="ml-auto px-6 py-2 bg-gold text-dark-bg rounded-xl hover:bg-gold-light transition text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranscriptViewer;
