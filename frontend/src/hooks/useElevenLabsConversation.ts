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
      // CRITICAL: Unlock audio playback FIRST using user interaction
      // Create and play a silent audio element to unlock browser audio restrictions
      console.log('🔓 Unlocking browser audio with user interaction...');
      const silentAudio = new Audio();
      silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      silentAudio.volume = 0.01; // Very quiet
      try {
        await silentAudio.play();
        console.log('✅ Browser audio unlocked successfully');
        silentAudio.pause();
        silentAudio.remove();
      } catch (unlockError) {
        console.warn('⚠️ Could not unlock audio with silent clip:', unlockError);
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      console.log('🎤 Microphone access granted', stream.getTracks());

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
        agentId,
        connectionType: 'webrtc',
        dynamicVariables: dynamicVars
      });

      const conversation = await Conversation.startSession({
        agentId,
        connectionType: "webrtc",
        // Pass dynamic variables for personalization
        dynamicVariables: Object.keys(dynamicVars).length > 0 ? dynamicVars : undefined,
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

      // Unlock audio context for iOS/mobile browsers
      console.log('🔓 Unlocking audio context for mobile...');
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        try {
          const audioCtx = new AudioContext();
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
            console.log('✅ Audio context unlocked');
          }
        } catch (ctxError) {
          console.warn('⚠️ Audio context unlock failed:', ctxError);
        }
      }

      // Set audio output to default device (for phones, computers, any device)
      // We use "default" deviceId to always route to the system's default audio output
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput');

        console.log('🔊 Available audio output devices:', audioOutputs.map(d => ({
          deviceId: d.deviceId,
          label: d.label,
          groupId: d.groupId
        })));

        // ALWAYS use "default" deviceId - this routes to system default output
        const defaultDeviceId = 'default';
        console.log('🎯 Using audio output: "default" (system default device)');

        // Function to set sink ID and unmute audio elements
        const setupAudioElement = async (audioElement: HTMLAudioElement) => {
          console.log('🔧 Setting up audio element:', {
            muted: audioElement.muted,
            volume: audioElement.volume,
            paused: audioElement.paused,
            src: audioElement.src,
            readyState: audioElement.readyState
          });

          // CRITICAL: Unmute and set volume
          audioElement.muted = false;
          audioElement.volume = 1.0;

          // Add autoplay attribute
          audioElement.autoplay = true;

          // Set output device first
          if (typeof audioElement.setSinkId === 'function') {
            try {
              await audioElement.setSinkId(defaultDeviceId);
              console.log('✅ Audio routed to default device');
            } catch (sinkError) {
              console.warn('⚠️ Could not set sink ID:', sinkError);
            }
          } else {
            console.warn('⚠️ setSinkId not supported in this browser');
          }

          // Add event listeners to auto-play when ready
          const attemptPlay = async () => {
            if (audioElement.paused && !audioElement.muted) {
              try {
                console.log('🎵 Attempting to play audio element...');
                await audioElement.play();
                console.log('✅ Audio element playing successfully!');
              } catch (playError) {
                console.warn('⚠️ Could not auto-play:', playError);
              }
            }
          };

          // Try to play immediately if src is ready
          if (audioElement.src && audioElement.readyState >= 2) {
            await attemptPlay();
          }

          // Listen for when audio becomes ready to play
          audioElement.addEventListener('canplay', attemptPlay, { once: true });
          audioElement.addEventListener('loadeddata', attemptPlay, { once: true });

          // Also listen for src changes
          const srcObserver = new MutationObserver(() => {
            if (audioElement.src) {
              console.log('🎵 Audio src changed to:', audioElement.src);
              attemptPlay();
            }
          });
          srcObserver.observe(audioElement, { attributes: true, attributeFilter: ['src'] });

          return true;
        };

        // Aggressive audio element detection with multiple retries
        const findAndSetupAudioElements = async (attempt: number = 1, maxAttempts: number = 10): Promise<boolean> => {
          const audioElements = document.querySelectorAll('audio');
          console.log(`🔍 Attempt ${attempt}/${maxAttempts}: Found ${audioElements.length} audio elements`);

          if (audioElements.length > 0) {
            for (const audioEl of audioElements) {
              await setupAudioElement(audioEl as HTMLAudioElement);
            }
            return true;
          }

          if (attempt < maxAttempts) {
            console.log(`⏳ Waiting 200ms before retry ${attempt + 1}...`);
            // Use Promise-based delay instead of setTimeout
            await new Promise(resolve => setTimeout(resolve, 200));
            return findAndSetupAudioElements(attempt + 1, maxAttempts);
          } else {
            console.warn('⚠️ No audio elements found after all retries');
            return false;
          }
        };

        // Start aggressive detection
        await findAndSetupAudioElements();

        // Set up a MutationObserver to catch audio elements as they're added
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeName === 'AUDIO') {
                console.log('🎤 NEW AUDIO ELEMENT DETECTED!');
                setupAudioElement(node as HTMLAudioElement);
              }
              // Also check children
              if (node instanceof HTMLElement) {
                const childAudioElements = node.querySelectorAll('audio');
                if (childAudioElements.length > 0) {
                  console.log(`🎤 Found ${childAudioElements.length} audio elements in new node`);
                  childAudioElements.forEach(audioEl => setupAudioElement(audioEl as HTMLAudioElement));
                }
              }
            });
          });
        });

        // Start observing the document for audio elements
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });

        console.log('👀 MutationObserver active - watching for audio elements');

        // Store observer reference to clean up later
        (conversationRef.current as any)._audioObserver = observer;

      } catch (deviceError) {
        console.error('❌ Could not set audio output device:', deviceError);
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
