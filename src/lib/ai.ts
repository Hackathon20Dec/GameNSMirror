// Backend API URL - all AI calls go through the server now
const API_BASE_URL = import.meta.env.VITE_SERVER_URL?.replace('wss://', 'https://').replace('ws://', 'http://') || 'http://localhost:3001';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ElevenLabs voice IDs for each character (used by backend)
const VOICE_IDS: Record<string, string> = {
  balaji: 'ErXwobaYiN019PkySvjV', // Antoni - deep, thoughtful male
  jackson: 'VR6AewLTigWG4xSOukaG', // Arnold - friendly, warm male
  otavio: 'TxGEqnHWrfWFTfGW9XjX', // Josh - direct, energetic male
  yash: 'pNInz6obpgDQGcFmaJgB', // Adam - clear, articulate male
};

// Fast character fallbacks (used if backend fails)
const CHARACTER_FALLBACKS: Record<string, string[]> = {
  balaji: [
    "So, that's the wrong frame. Think bigger.",
    "That's legacy thinking. Let me reframe.",
    "Interesting. But what are you building?",
    "The pattern here is clear if you look.",
  ],
  jackson: [
    "Oh I love that! Tell me more.",
    "That resonates. What's the first step?",
    "Haha okay, I see you. Keep going.",
    "That's cool! What would make it work?",
  ],
  otavio: [
    "Cool. What have you shipped though?",
    "That's weak. What's the MVP?",
    "Nah, be specific. What's the blocker?",
    "Prove it. Show me data.",
  ],
  yash: [
    "What's the constraint there?",
    "Let's break that down. What's blocking you?",
    "Interesting. What's the spec?",
    "What would need to be true for that to work?",
  ],
};

// Audio state management - prevent duplicate playback
let currentAudio: HTMLAudioElement | null = null;
let lastPlayedMessage: string = '';

/**
 * Play text as speech using backend TTS endpoint
 */
export async function speakText(text: string, npcId: string): Promise<void> {
  // Prevent duplicate playback of same message
  if (text === lastPlayedMessage) {
    return;
  }
  lastPlayedMessage = text;

  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        npcId: npcId,
      }),
    });

    if (!response.ok) {
      console.warn('TTS failed:', response.status);
      return;
    }

    // Get audio blob from response
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    currentAudio = new Audio(audioUrl);
    currentAudio.volume = 0.8;

    currentAudio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
    };

    currentAudio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
    };

    await currentAudio.play();
  } catch (error) {
    console.warn('TTS error:', error);
  }
}

/**
 * Stop any currently playing audio
 */
export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  lastPlayedMessage = '';
}

function getCharacterFallback(npcId?: string): string {
  const fallbacks = npcId && CHARACTER_FALLBACKS[npcId.toLowerCase()]
    ? CHARACTER_FALLBACKS[npcId.toLowerCase()]
    : ["That's interesting. Tell me more."];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

/**
 * AI chat - calls backend API which uses OpenRouter
 */
export async function chat(
  systemPrompt: string,
  messages: ChatMessage[],
  npcId?: string
): Promise<string> {
  try {
    // Call backend API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemPrompt,
        messages,
        npcId,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API ${response.status}`);
    }

    const data = await response.json();

    if (data.response && data.response.length > 0) {
      return data.response;
    }

    throw new Error('Empty response');
  } catch (error) {
    console.warn('AI chat failed, using fallback:', error);
    return getCharacterFallback(npcId);
  }
}
