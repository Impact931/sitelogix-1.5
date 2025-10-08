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
      const apiKey = import.meta.env.VITE_ELEVEN_LABS_API_KEY;
      const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
        headers: {
          'xi-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch conversation: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Conversation data:', data);
      return data;
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

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Attempting to fetch conversation audio (attempt ${attempt}/${retries})...`);

        const apiKey = import.meta.env.VITE_ELEVEN_LABS_API_KEY;

        // Try multiple possible endpoints
        const endpoints = [
          `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
          `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/recording`
        ];

        let lastError = null;

        for (const endpoint of endpoints) {
          try {
            console.log(`Trying endpoint: ${endpoint}`);

            const response = await fetch(endpoint, {
              method: 'GET',
              headers: {
                'xi-api-key': apiKey,
                'Accept': 'audio/*,application/octet-stream'
              },
            });

            console.log(`Response status: ${response.status} ${response.statusText}`);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));

            if (response.ok) {
              const audioBlob = await response.blob();
              console.log('Audio blob downloaded:', audioBlob.size, 'bytes', 'type:', audioBlob.type);

              if (audioBlob.size > 0) {
                return audioBlob;
              } else {
                console.warn('Audio blob is empty, trying next endpoint or retry...');
              }
            } else {
              const errorText = await response.text();
              console.error(`Endpoint ${endpoint} failed:`, response.status, errorText);
              lastError = new Error(`${response.status}: ${errorText}`);
            }
          } catch (endpointError) {
            console.error(`Error with endpoint ${endpoint}:`, endpointError);
            lastError = endpointError;
          }
        }

        // If we got here, all endpoints failed
        if (attempt < retries) {
          console.log(`All endpoints failed, waiting ${delayMs}ms before retry ${attempt + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          throw lastError || new Error('All audio endpoints failed');
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
