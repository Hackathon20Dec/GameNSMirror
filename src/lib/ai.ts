const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || '';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ElevenLabs voice IDs for each character (using their pre-made voices)
const VOICE_IDS: Record<string, string> = {
  balaji: 'ErXwobaYiN019PkySvjV', // Antoni - deep, thoughtful male
  jackson: 'VR6AewLTigWG4xSOukaG', // Arnold - friendly, warm male
  otavio: 'TxGEqnHWrfWFTfGW9XjX', // Josh - direct, energetic male
  yash: 'pNInz6obpgDQGcFmaJgB', // Adam - clear, articulate male
};

// Fast character fallbacks
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
 * Play text as speech using ElevenLabs - STREAMING for low latency
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

  const voiceId = VOICE_IDS[npcId] || VOICE_IDS.jackson;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_turbo_v2_5', // Fastest model
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true
          }
        }),
      }
    );

    if (!response.ok) {
      console.warn('ElevenLabs TTS failed:', response.status);
      return;
    }

    // Stream the audio
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
 * Ultra-fast AI chat - optimized for <1 second response
 */
export async function chat(
  systemPrompt: string,
  messages: ChatMessage[],
  npcId?: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    return getCharacterFallback(npcId);
  }

  try {
    // AGGRESSIVE timeout - 3 seconds max
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'NetworkSim',
      },
      body: JSON.stringify({
        // Use FASTEST models - Groq's llama is insanely fast
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-4) // Only last 4 messages for speed
        ],
        max_tokens: 80, // Short responses = fast
        temperature: 0.9,
        top_p: 0.9,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (content && content.length > 0) {
      return content;
    }

    throw new Error('Empty');
  } catch (error) {
    console.warn('AI fast-path failed, using fallback:', error);
    return getCharacterFallback(npcId);
  }
}
