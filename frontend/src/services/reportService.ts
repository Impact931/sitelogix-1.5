// API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

interface SaveReportParams {
  audioBlob: Blob | null;
  transcript: any;
  managerId: string;
  managerName: string;
  projectId: string;
  projectName: string;
  projectLocation: string;
  reportDate: string;
  conversationId: string;
}

// Helper function to convert Blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const saveReport = async (params: SaveReportParams) => {
  const {
    audioBlob,
    transcript,
    managerId,
    managerName,
    projectId,
    projectName,
    projectLocation,
    reportDate,
    conversationId,
  } = params;

  console.log('💾 Saving report via API...');

  try {
    // Convert audio blob to base64 if available
    let audioBase64 = null;
    if (audioBlob && audioBlob.size > 0) {
      console.log('🎵 Converting audio to base64...');
      audioBase64 = await blobToBase64(audioBlob);
      console.log(`✅ Audio converted (${audioBase64.length} characters)`);
    } else {
      console.log('ℹ️  No audio available');
    }

    // Send to API endpoint
    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioBase64,
        transcript,
        managerId,
        managerName,
        projectId,
        projectName,
        projectLocation,
        reportDate,
        conversationId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Report saved successfully:', result);

    return result;
  } catch (error) {
    console.error('❌ Error saving report:', error);
    throw error;
  }
};
