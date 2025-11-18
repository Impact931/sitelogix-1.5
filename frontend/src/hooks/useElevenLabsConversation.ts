import { useState, useCallback, useRef } from 'react';
import { Conversation } from '@elevenlabs/client';

interface UseElevenLabsConversationProps {
  agentId: string;
  onStatusChange?: (status: string) => void;
  onError?: (error: Error) => void;
  onMessage?: (message: any) => void;
  customContext?: {
    managerName?: string;
    managerId?: string;
    projectName?: string;
    projectLocation?: string;
  };
}

export const useElevenLabsConversation = ({
  agentId,
  onStatusChange,
  onError,
  onMessage,
  customContext,
}: UseElevenLabsConversationProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationRef = useRef<Conversation | null>(null);

  const startConversation = useCallback(async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      console.log('🎤 Microphone access granted', stream.getTracks());

      onStatusChange?.('Fetching secure conversation token...');

      // Fetch conversation token from backend (secure - API key not exposed)
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      console.log('🔐 Requesting conversation token from backend...');

      const tokenResponse = await fetch(`${API_BASE_URL}/elevenlabs/conversation-token`);
      if (!tokenResponse.ok) {
        throw new Error(`Failed to fetch conversation token: ${tokenResponse.statusText}`);
      }

      const tokenData = await tokenResponse.json();
      if (!tokenData.success || !tokenData.signedUrl) {
        throw new Error('Invalid token response from backend');
      }

      const conversationToken = tokenData.signedUrl;
      console.log('✅ Conversation token received');

      onStatusChange?.('Connecting to Roxy...');

      // Initialize ElevenLabs conversation with dynamic variables
      // Dynamic variables inject runtime data into agent's context
      // Build dynamic variables object, filtering out undefined values
      const dynamicVars: Record<string, string | number | boolean> = {};
      if (customContext?.managerName) dynamicVars.manager_name = customContext.managerName;
      if (customContext?.managerId) dynamicVars.manager_id = customContext.managerId;
      if (customContext?.projectName) dynamicVars.project_name = customContext.projectName;
      if (customContext?.projectLocation) dynamicVars.project_location = customContext.projectLocation;

      console.log('🔧 Starting ElevenLabs session with config:', {
        conversationToken: conversationToken.substring(0, 50) + '...',
        connectionType: 'webrtc',
        dynamicVariables: dynamicVars,
        managerName: customContext?.managerName
      });

      const conversation = await Conversation.startSession({
        conversationToken: conversationToken,
        connectionType: "webrtc",
        // Pass dynamic variables for personalization
        dynamicVariables: Object.keys(dynamicVars).length > 0 ? dynamicVars : undefined,
        // Override agent settings to include first message
        overrides: {
          agent: {
            firstMessage: `Hi ${customContext?.managerName || 'there'}! This is Roxy, your AI assistant for daily construction reports. I'm ready to help you record today's report for ${customContext?.projectName || 'your project'}. Let's start with the time - what time did you arrive on site today?`,
            language: 'en'
          }
        },
        onConnect: (data) => {
          console.log('✅ Connected to ElevenLabs agent', data);
          console.log('Conversation object:', conversationRef.current);

          // Try multiple ways to get conversation ID
          let convId = null;

          // Method 1: From connection data
          if (data && typeof data === 'object' && 'conversationId' in data) {
            convId = data.conversationId;
          }

          // Method 2: From conversation object properties
          if (!convId && conversationRef.current) {
            const conv = conversationRef.current as any;
            convId = conv.conversationId || conv.id || conv._conversationId || null;
          }

          console.log('Conversation ID:', convId);
          setConversationId(convId);

          setIsConnected(true);
          onStatusChange?.('Connected');
        },
        onDisconnect: () => {
          console.log('Disconnected from ElevenLabs agent');
          setIsConnected(false);
          setIsSpeaking(false);
          onStatusChange?.('Disconnected');
        },
        onError: (error: unknown) => {
          console.error('ElevenLabs error:', error);
          const err = error && typeof error === 'object' && 'message' in error
            ? new Error((error as { message: string }).message)
            : new Error(String(error));
          onError?.(err);
        },
        onModeChange: (mode) => {
          console.log('Mode changed:', mode);
          // mode can be 'speaking' or 'listening'
          setIsSpeaking(mode.mode === 'speaking');
        },
        onMessage: (message) => {
          console.log('Message received:', message);
          onMessage?.(message);
        },
      });

      conversationRef.current = conversation;

      // Set audio output to maximum volume
      console.log('🔊 Setting volume to maximum...');
      await conversation.setVolume({ volume: 1.0 });
      console.log('✅ Volume set successfully');

      // Set audio output to default device (for phones, computers, any device)
      // We use "default" deviceId to always route to the system's default audio output
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput');

        console.log('🔊 Available audio output devices:', audioOutputs.map(d => ({
          deviceId: d.deviceId,
          label: d.label
        })));

        // ALWAYS use "default" deviceId - this routes to system default output
        const defaultDeviceId = 'default';
        console.log('🎯 Using audio output: "default" (system default device)');

        // Function to set sink ID on audio elements AND monitor/trigger playback
        const setAudioOutputDevice = async (audioElement: HTMLAudioElement) => {
          // LOG: Detailed audio element state
          console.log('🔧 Configuring audio element:', {
            muted: audioElement.muted,
            volume: audioElement.volume,
            paused: audioElement.paused,
            src: audioElement.src,
            srcObject: audioElement.srcObject,
            readyState: audioElement.readyState,
            networkState: audioElement.networkState
          });

          // CRITICAL: Ensure unmuted and max volume
          audioElement.muted = false;
          audioElement.volume = 1.0;
          audioElement.autoplay = true;

          // Set output device
          if (typeof audioElement.setSinkId === 'function') {
            try {
              await audioElement.setSinkId(defaultDeviceId);
              console.log('✅ Audio routed to default device');
            } catch (sinkError) {
              console.warn('⚠️ Could not set sink ID:', sinkError);
            }
          }

          // CRITICAL: Monitor and attempt playback
          const tryPlay = async (reason: string) => {
            if ((audioElement.src || audioElement.srcObject) && audioElement.paused) {
              try {
                console.log(`🎵 [${reason}] Audio has source, attempting play...`);
                await audioElement.play();
                console.log('✅ Audio playing!');
              } catch (playError) {
                console.warn(`⚠️ Play failed (${reason}):`, playError);
              }
            }
          };

          // Try to play immediately if source exists
          await tryPlay('initial');

          // Watch for source changes
          const checkForSource = async () => {
            if (audioElement.srcObject && audioElement.paused) {
              console.log('🎵 srcObject detected (WebRTC stream)!');
              await tryPlay('srcObject-detected');
            }
          };

          // Add event listeners
          audioElement.addEventListener('loadeddata', () => tryPlay('loadeddata'));
          audioElement.addEventListener('canplay', () => tryPlay('canplay'));

          // Monitor for srcObject changes every second (WebRTC streams)
          const monitorInterval = setInterval(checkForSource, 1000);
          (audioElement as any)._monitorInterval = monitorInterval;

          return true;
        };

        // Method 1: Try to set on existing audio elements
        let audioElements = document.querySelectorAll('audio');
        console.log(`Found ${audioElements.length} audio elements on page initially`);

        for (const audioEl of audioElements) {
          await setAudioOutputDevice(audioEl as HTMLAudioElement);
        }

        // Method 2: Watch for new audio elements (ElevenLabs creates them dynamically)
        // Check again after a short delay
        setTimeout(async () => {
          console.log('🔍 Checking for audio elements again after 500ms...');
          audioElements = document.querySelectorAll('audio');
          console.log(`Found ${audioElements.length} audio elements on page now`);

          for (const audioEl of audioElements) {
            await setAudioOutputDevice(audioEl as HTMLAudioElement);
          }
        }, 500);

        // Method 3: Set up a MutationObserver to catch audio elements as they're added
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeName === 'AUDIO') {
                console.log('🎤 New audio element detected, setting output device...');
                setAudioOutputDevice(node as HTMLAudioElement);
              }
            });
          });
        });

        // Start observing the document for audio elements
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });

        // Store observer reference to clean up later
        (conversationRef.current as any)._audioObserver = observer;

      } catch (deviceError) {
        console.warn('Could not set audio output device:', deviceError);
      }

    } catch (error) {
      console.error('Failed to start conversation:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, [agentId, onStatusChange, onError, onMessage, customContext]);

  const endConversation = useCallback(async () => {
    try {
      if (conversationRef.current) {
        console.log('🛑 Ending conversation...');

        // Clean up the audio observer
        const observer = (conversationRef.current as any)._audioObserver;
        if (observer) {
          observer.disconnect();
          console.log('🔇 Audio observer disconnected');
        }

        // Clean up all audio monitoring intervals
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach((audioEl) => {
          const interval = (audioEl as any)._monitorInterval;
          if (interval) {
            clearInterval(interval);
            console.log('🔇 Audio monitor interval cleared');
          }
        });

        await conversationRef.current.endSession();
        conversationRef.current = null;
        setIsConnected(false);
        setIsSpeaking(false);
        onStatusChange?.('Ended');
        console.log('✅ Conversation ended');
      }
    } catch (error) {
      console.error('Failed to end conversation:', error);
      onError?.(error as Error);
    }
  }, [onStatusChange, onError]);

  const getConversationTranscript = useCallback(async () => {
    if (!conversationId) {
      console.error('No conversation ID available');
      return null;
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE_URL}/elevenlabs/transcript/${conversationId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch conversation: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch transcript');
      }

      console.log('Conversation data:', result.data);
      return result.data;
    } catch (error) {
      console.error('Failed to get conversation transcript:', error);
      onError?.(error as Error);
      return null;
    }
  }, [conversationId, onError]);

  const getConversationAudio = useCallback(async (retries = 3, delayMs = 2000) => {
    if (!conversationId) {
      console.error('No conversation ID available');
      return null;
    }

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Attempting to fetch conversation audio (attempt ${attempt}/${retries})...`);

        const response = await fetch(`${API_BASE_URL}/elevenlabs/audio/${conversationId}`);

        console.log(`Response status: ${response.status} ${response.statusText}`);

        if (response.ok) {
          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error || 'Failed to fetch audio');
          }

          // Convert base64 back to blob
          const audioBase64 = result.data;
          const binaryString = atob(audioBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const audioBlob = new Blob([bytes], { type: result.contentType || 'audio/webm' });

          console.log('Audio blob created:', audioBlob.size, 'bytes', 'type:', audioBlob.type);

          if (audioBlob.size > 0) {
            return audioBlob;
          } else {
            console.warn('Audio blob is empty, retrying...');
          }
        } else {
          const errorText = await response.text();
          console.error(`Backend audio fetch failed:`, response.status, errorText);
          throw new Error(`${response.status}: ${errorText}`);
        }

        // If we got here, the blob was empty or failed
        if (attempt < retries) {
          console.log(`Waiting ${delayMs}ms before retry ${attempt + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          throw new Error('Failed to fetch valid audio after all retries');
        }

      } catch (error) {
        console.error(`Failed to get conversation audio (attempt ${attempt}/${retries}):`, error);

        if (attempt === retries) {
          onError?.(error as Error);
          return null;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return null;
  }, [conversationId, onError]);

  return {
    isConnected,
    isSpeaking,
    conversationId,
    startConversation,
    endConversation,
    getConversationTranscript,
    getConversationAudio,
  };
};
