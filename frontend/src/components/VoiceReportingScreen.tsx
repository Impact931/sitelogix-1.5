import React, { useState, useEffect } from 'react';
import { useElevenLabsConversation } from '../hooks/useElevenLabsConversation';
import { saveReport } from '../services/reportService';
import { getChecklistItems, getChecklistKeywords } from '../config/checklistConfig';
import TranscriptViewer from './TranscriptViewer';
import DailyReportChecklist from './DailyReportChecklist';

interface Manager {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  location: string;
}

interface VoiceReportingScreenProps {
  manager: Manager;
  project: Project;
  onChangeProject: () => void;
  onViewReports: () => void;
  onViewAnalytics?: () => void;
  onLogout?: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const VoiceReportingScreen: React.FC<VoiceReportingScreenProps> = ({
  manager,
  project,
  onChangeProject,
  onViewReports,
  onViewAnalytics,
  onLogout
}) => {
  const [status, setStatus] = useState<string>('Ready');
  const [error, setError] = useState<string | null>(null);
  const [currentChecklistItem, setCurrentChecklistItem] = useState<string | null>(null);
  const [completedItems, setCompletedItems] = useState<Set<number>>(new Set());
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptData, setTranscriptData] = useState<any>(null);
  const [lastReportId, setLastReportId] = useState<string | null>(null);
  const [reportHtmlUrl, setReportHtmlUrl] = useState<string | null>(null);

  // Load configurable checklist items
  const [checklistItems, setChecklistItems] = useState(() => getChecklistItems());
  const [checklistKeywords, setChecklistKeywords] = useState(() => getChecklistKeywords(checklistItems));

  const [agentId, setAgentId] = useState<string>('');

  // Fetch ElevenLabs agent ID from backend (secure - API key not exposed)
  useEffect(() => {
    const fetchAgentConfig = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');
        const response = await fetch(`${API_BASE_URL}/elevenlabs/agent-config`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        const data = await response.json();
        if (data.success && data.agentId) {
          setAgentId(data.agentId);
        }
      } catch (error) {
        console.error('Failed to fetch ElevenLabs config:', error);
        // Fallback to env var for development
        setAgentId(import.meta.env.VITE_ELEVEN_LABS_AGENT_ID || '');
      }
    };
    fetchAgentConfig();
  }, []);

  // Reload checklist if it changes (e.g., admin updates it)
  useEffect(() => {
    const handleStorageChange = () => {
      const items = getChecklistItems();
      setChecklistItems(items);
      setChecklistKeywords(getChecklistKeywords(items));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const {
    isConnected,
    isSpeaking,
    conversationId,
    startConversation,
    endConversation,
    getConversationTranscript,
    getConversationAudio
  } = useElevenLabsConversation({
    agentId,
    customContext: {
      managerName: manager.name,
      managerId: manager.id,
      projectName: project.name,
      projectLocation: project.location,
    },
    onStatusChange: (newStatus) => {
      setStatus(newStatus);
      if (newStatus === 'Connected') {
        setCurrentChecklistItem(checklistItems[0]?.question || null);
      }
    },
    onMessage: (message) => {
      // Check if message contains keywords for any checklist item
      console.log('Checking message for keywords:', message);

      // Get the actual message text from the message object
      let messageText = '';
      if (typeof message === 'string') {
        messageText = message.toLowerCase();
      } else if (message && typeof message === 'object') {
        // Try to extract text from message object
        messageText = (message.message || message.text || message.content || JSON.stringify(message)).toLowerCase();
      }

      checklistKeywords.forEach((keywords, index) => {
        const matched = keywords.some(keyword => messageText.includes(keyword.toLowerCase()));
        if (matched) {
          console.log(`Checklist item ${index} matched:`, keywords);
          setCompletedItems(prev => {
            const newSet = new Set(prev);
            newSet.add(index);
            return newSet;
          });
        }
      });
    },
    onError: (err) => {
      setError(err.message);
      console.error('Conversation error:', err);
    },
  });

  const handleStartRecording = async () => {
    setError(null);

    // Prevent starting if agent ID hasn't loaded yet
    if (!agentId) {
      setError('Loading ElevenLabs configuration... Please try again in a moment.');
      setStatus('Waiting for agent configuration...');
      return;
    }

    await startConversation();
  };

  const handleStopRecording = async () => {
    setStatus('Ending conversation...');
    await endConversation();
    setCurrentChecklistItem(null);

    // Wait longer for the conversation to finalize on ElevenLabs side
    setStatus('Waiting for conversation to finalize on ElevenLabs...');
    setTimeout(async () => {
      setStatus('Downloading conversation data...');
      try {
        // Get transcript with retry logic - ElevenLabs needs time to process
        let transcript = null;
        let attempts = 0;
        const maxAttempts = 6; // Try for up to 30 seconds
        const retryDelay = 5000; // 5 seconds between attempts

        while (attempts < maxAttempts && !transcript) {
          attempts++;
          setStatus(`Fetching transcript (attempt ${attempts}/${maxAttempts})...`);

          try {
            const result = await getConversationTranscript();

            if (result) {
              // Check if conversation is fully processed
              if (result.status === 'done' && result.transcript && result.transcript.length > 0) {
                console.log('✅ Full conversation transcript received:', result);
                console.log(`   - Status: ${result.status}`);
                console.log(`   - Messages: ${result.transcript.length}`);
                transcript = result;
                break;
              } else if (result.status === 'processing' || result.status === 'in-progress') {
                console.log(`⏳ Conversation still processing (status: ${result.status}), waiting...`);
              } else if (result.status === 'failed') {
                console.error('❌ Conversation processing failed on ElevenLabs');
                break;
              } else {
                console.warn(`⚠️ Unexpected status: ${result.status}`);
              }
            }

            // Wait before next attempt (unless this was the last attempt)
            if (attempts < maxAttempts && !transcript) {
              console.log(`   Waiting ${retryDelay / 1000}s before retry...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
          } catch (fetchError) {
            console.warn(`Attempt ${attempts} failed:`, fetchError);
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
          }
        }

        // If still no transcript after all attempts, save with conversation ID for later retrieval
        if (!transcript || !transcript.transcript || transcript.transcript.length === 0) {
          console.warn('⚠️ Could not fetch complete transcript after retries');
          console.warn('   Report will be saved with conversationId for later retrieval');
          transcript = {
            conversation_id: conversationId,
            status: 'pending',
            note: 'Transcript not yet available from ElevenLabs - conversation may still be processing'
          };
        }

        // Try to get audio with retries (increased delays for processing time)
        let audioBlob: Blob | null = null;
        try {
          setStatus('Downloading audio (this may take a moment)...');
          audioBlob = await getConversationAudio(6, 5000); // 6 retries, 5 seconds between (up to 30s total)
          if (audioBlob && audioBlob.size > 0) {
            console.log('✅ Audio blob downloaded successfully:', audioBlob.size, 'bytes', 'type:', audioBlob.type);
            console.log('Format: WebM (Opus codec) - optimized for voice, smaller file size than MP3');
          } else {
            console.warn('⚠️ Audio download returned empty blob');
          }
        } catch (audioError) {
          console.warn('Could not fetch audio, will continue without it:', audioError);
        }

        if (conversationId) {
          setStatus('Uploading report to S3 and DynamoDB...');

          try {
            console.log('🔍 VoiceReportingScreen - Saving report with project:', {
              project,
              projectId: project.id,
              projectName: project.name
            });

            const result = await saveReport({
              audioBlob,
              transcript,
              managerId: manager.id,
              managerName: manager.name,
              projectId: project.id,
              projectName: project.name,
              projectLocation: project.location,
              reportDate: new Date().toISOString().split('T')[0],
              conversationId,
            });

            console.log('='.repeat(80));
            console.log('REPORT SUCCESSFULLY SAVED:');
            console.log('='.repeat(80));
            console.log('Report ID:', result.reportId);
            console.log('Conversation ID:', conversationId);
            console.log('Manager:', manager.name, `(${manager.id})`);
            console.log('Project ID:', project.id);
            console.log('Project Name:', project.name);
            console.log('Audio S3 Path:', result.audioPath || 'No audio');
            console.log('Transcript S3 Path:', result.transcriptPath);
            console.log('Full transcript:', transcript);
            console.log('='.repeat(80));

            // Also save to localStorage as backup
            const reportData = {
              reportId: result.reportId,
              conversationId,
              managerId: manager.id,
              managerName: manager.name,
              projectId: project.id,
              projectName: project.name,
              projectLocation: project.location,
              reportDate: new Date().toISOString().split('T')[0],
              timestamp: new Date().toISOString(),
              transcript,
              hasAudio: !!audioBlob && audioBlob.size > 0,
              audioS3Path: result.audioPath,
              transcriptS3Path: result.transcriptPath,
            };
            const reports = JSON.parse(localStorage.getItem('sitelogix_reports') || '[]');
            reports.push(reportData);
            localStorage.setItem('sitelogix_reports', JSON.stringify(reports));

            // Save report ID and construct HTML URL
            setLastReportId(result.reportId);
            const [year, month, day] = reportData.reportDate.split('-');
            const htmlUrl = `https://sitelogix-prod.s3.amazonaws.com/SITELOGIX/projects/${project.id}/reports/${year}/${month}/${day}/${result.reportId}/report.html`;
            setReportHtmlUrl(htmlUrl);

            setStatus('Report successfully saved to S3 and DynamoDB!');
          } catch (uploadError) {
            console.error('Error uploading to S3/DynamoDB:', uploadError);

            // Fallback to localStorage only
            const reportData = {
              reportId: `rpt_${new Date().toISOString().split('T')[0].replace(/-/g, '')}_${manager.id}_${Date.now()}`,
              conversationId,
              managerId: manager.id,
              managerName: manager.name,
              projectId: project.id,
              projectName: project.name,
              projectLocation: project.location,
              reportDate: new Date().toISOString().split('T')[0],
              timestamp: new Date().toISOString(),
              transcript,
              hasAudio: !!audioBlob && audioBlob.size > 0,
              savedToCloud: false,
            };
            const reports = JSON.parse(localStorage.getItem('sitelogix_reports') || '[]');
            reports.push(reportData);
            localStorage.setItem('sitelogix_reports', JSON.stringify(reports));

            setStatus('Report saved locally (cloud upload failed)');
            setError('Failed to upload to cloud. Report saved locally.');
          }
        } else {
          console.error('Missing conversation ID');
          setStatus('Error: Missing conversation ID');
        }
      } catch (error) {
        console.error('Error saving report:', error);
        setStatus('Error saving report');
        setError(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 8000); // Increased to 8 seconds to give ElevenLabs time to process and prepare audio
  };

  const handleViewTranscript = async () => {
    const transcript = await getConversationTranscript();
    if (transcript) {
      setTranscriptData(transcript);
      setShowTranscript(true);
    }
  };

  const handleViewReport = async () => {
    if (!lastReportId) return;

    try {
      // Open HTML report served directly by API
      const reportDate = new Date().toISOString().split('T')[0];
      // CRITICAL: URL-encode report ID to handle special characters like # in IDs
      const encodedReportId = encodeURIComponent(lastReportId);
      const url = `${API_BASE_URL}/reports/${encodedReportId}/html?projectId=${project.id}&reportDate=${reportDate}`;
      console.log('🔑 Opening report ID (raw):', lastReportId);
      console.log('🔑 Opening report ID (encoded):', encodedReportId);
      console.log('📡 Opening URL:', url);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error opening report:', err);
      setError('Failed to open report');
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="glass-gold border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-display font-bold text-white">SiteLogix</h1>
              <p className="text-gray-400 text-sm mt-1 font-medium">
                {manager.name} • {project.name}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {onViewAnalytics && (
                <button
                  onClick={onViewAnalytics}
                  className="px-4 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-xl hover:shadow-lg hover:shadow-gold/20 transition text-sm font-semibold flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  <span>Analytics</span>
                </button>
              )}
              <button
                onClick={onViewReports}
                className="px-4 py-2 glass rounded-xl text-white hover:bg-white/10 transition text-sm font-medium flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Reports</span>
              </button>
              <button
                onClick={onChangeProject}
                className="px-4 py-2 glass rounded-xl text-white hover:bg-white/10 transition text-sm font-medium"
              >
                Change Project
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="px-4 py-2 glass rounded-xl text-red-400 hover:bg-red-500/10 transition text-sm font-medium flex items-center space-x-2"
                  title="Logout"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Logout</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 glass-gold rounded-2xl p-4 border border-red-500/30">
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        )}

        {!isConnected ? (
          // Initial Microphone Button
          <div className="text-center space-y-10">
            <div>
              <h2 className="text-5xl font-display font-bold text-white mb-4">
                Daily Report
              </h2>
              <p className="text-gray-400 text-lg font-medium">
                {status === 'Connecting to Roxy...' ? status : 'Ready to record your daily construction report'}
              </p>
            </div>

            {/* Large Microphone Button */}
            <div className="flex flex-col items-center">
              <button
                onClick={handleStartRecording}
                disabled={!agentId || status === 'Connecting to Roxy...'}
                className="group relative w-64 h-64 bg-gradient-to-br from-gold-light to-gold-dark rounded-full flex items-center justify-center hover:scale-105 hover:shadow-2xl hover:shadow-gold/30 focus:outline-none focus:ring-4 focus:ring-gold/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <svg className="w-32 h-32 text-dark-bg" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </button>
              <p className="mt-6 text-xl font-semibold text-white">
                {!agentId ? 'Loading Roxy...' : status === 'Connecting to Roxy...' ? 'Connecting...' : 'Press to Call Roxy'}
              </p>
            </div>

            {/* Session Info */}
            <div className="glass rounded-2xl p-6 max-w-2xl mx-auto">
              <h3 className="text-sm font-semibold text-white mb-4">Session Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 mb-1">Manager</p>
                  <p className="text-white font-medium">{manager.name}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Employee Number</p>
                  <p className="text-white font-medium">{manager.id.replace(/^PER#/, '')}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Project</p>
                  <p className="text-white font-medium">{project.name}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Location</p>
                  <p className="text-white font-medium">{project.location}</p>
                </div>
                {conversationId && (
                  <div className="col-span-2">
                    <p className="text-gray-400 mb-1">Conversation ID</p>
                    <p className="text-white font-medium font-mono text-xs">{conversationId}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={handleViewTranscript}
                        className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition border border-white/20"
                      >
                        View Transcript
                      </button>
                      {lastReportId && reportHtmlUrl && (
                        <button
                          onClick={handleViewReport}
                          className="px-4 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-gold/20 transition"
                        >
                          📄 View HTML Report
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Recording Interface with Checklist
          <div className="space-y-6">
            {/* Connection Status */}
            <div className="glass-gold rounded-2xl p-6">
              <div className="flex items-center justify-center space-x-4">
                <div className="relative">
                  <div className={`w-4 h-4 rounded-full animate-pulse ${isSpeaking ? 'bg-gold' : 'bg-green-500'}`}></div>
                  <div className={`absolute inset-0 w-4 h-4 rounded-full animate-ping ${isSpeaking ? 'bg-gold' : 'bg-green-500'}`}></div>
                </div>
                <p className="text-white font-bold text-lg">
                  {isSpeaking ? 'Roxy is speaking...' : 'Connected - Listening'}
                </p>
              </div>
            </div>

            {/* Current Checklist Item */}
            {currentChecklistItem && (
              <div className="glass rounded-2xl p-8">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Current Question</h3>
                <p className="text-3xl font-display text-white font-bold">
                  {currentChecklistItem}
                </p>
              </div>
            )}

            {/* Checklist Progress */}
            <DailyReportChecklist
              items={checklistItems}
              completedItemIds={completedItems}
              compact={true}
            />

            {/* End Conversation Button */}
            <button
              onClick={handleStopRecording}
              className="w-full bg-red-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:bg-red-700 hover:shadow-xl hover:shadow-red-600/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-dark-bg transition-all duration-200"
            >
              End Conversation
            </button>
          </div>
        )}
      </main>

      {/* Transcript Viewer Modal */}
      {showTranscript && (
        <TranscriptViewer
          transcript={transcriptData}
          onClose={() => setShowTranscript(false)}
          conversationId={conversationId || ''}
          managerName={manager.name}
          projectName={project.name}
          reportDate={new Date().toISOString().split('T')[0]}
        />
      )}
    </div>
  );
};

export default VoiceReportingScreen;
