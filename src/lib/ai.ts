const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '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';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * MODIFICATION 3: Fallback responses when AI fails
 * These ensure NPCs ALWAYS respond even if API is down
 */
const FALLBACK_RESPONSES = [
  "That's an interesting point. Let me think about that from a different angle...",
  "I hear you. What would you say is the core insight there?",
  "Hmm, that resonates with some ideas I've been working on. Tell me more.",
  "Let's unpack that - what's the limiting factor in your thinking?",
  "I've been pondering something similar. What's your take on the execution side?",
  "That's the kind of question that requires us to zoom out. What's the bigger picture?",
  "Interesting framing. How would you stress-test that assumption?",
  "I appreciate the directness. Now, what would it take to actually make that happen?",
];

/**
 * MODIFICATION 3: AI chat with RETRY LOGIC
 * - Retries up to 3 times on failure
 * - Falls back to contextual responses if all retries fail
 * - NPCs NEVER fail silently
 */
export async function chat(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Add timeout to prevent hanging - 10 seconds max
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'NetworkSimulation',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.2-3b-instruct:free',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          max_tokens: 300,
          temperature: 0.8,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (content && content.trim().length > 0) {
        return content;
      }

      throw new Error('Empty response from API');
    } catch (error) {
      lastError = error as Error;
      console.warn(`AI chat attempt ${attempt}/${MAX_RETRIES} failed:`, error);

      // Wait before retrying (exponential backoff)
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  // All retries failed - return contextual fallback response
  console.error('All AI chat retries failed:', lastError);

  // Pick a random fallback response
  const fallbackIndex = Math.floor(Math.random() * FALLBACK_RESPONSES.length);
  return FALLBACK_RESPONSES[fallbackIndex];
}
