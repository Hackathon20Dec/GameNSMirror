import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// API Keys from environment
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

app.use(cors());
app.use(express.json());

// Store connected players
const players = new Map();

// Store action logs (last 1000)
const actionLogs = [];
const MAX_LOGS = 1000;

// Character fallbacks for when API fails
const CHARACTER_FALLBACKS = {
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

function getCharacterFallback(npcId) {
  const fallbacks = npcId && CHARACTER_FALLBACKS[npcId.toLowerCase()]
    ? CHARACTER_FALLBACKS[npcId.toLowerCase()]
    : ["That's interesting. Tell me more."];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function addLog(log) {
  actionLogs.push({
    ...log,
    timestamp: Date.now()
  });
  if (actionLogs.length > MAX_LOGS) {
    actionLogs.shift();
  }
}

// Broadcast to all players except sender
function broadcast(senderId, message) {
  wss.clients.forEach((client) => {
    const playerData = [...players.entries()].find(([_, p]) => p.ws === client);
    if (playerData && playerData[0] !== senderId && client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}

// Broadcast to ALL players
function broadcastAll(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}

// ============================================
// AI CHAT ENDPOINT - Uses OpenRouter API
// ============================================
app.post('/api/chat', async (req, res) => {
  const { systemPrompt, messages, npcId } = req.body;

  if (!OPENROUTER_API_KEY) {
    console.warn('No OPENROUTER_API_KEY set, using fallback');
    return res.json({ response: getCharacterFallback(npcId) });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://networksimulation.onrender.com',
        'X-Title': 'NetworkSim',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-4) // Only last 4 messages for speed
        ],
        max_tokens: 150,
        temperature: 0.9,
        top_p: 0.9,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (content && content.length > 0) {
      return res.json({ response: content });
    }

    throw new Error('Empty response from API');
  } catch (error) {
    console.warn('AI chat error, using fallback:', error.message);
    return res.json({ response: getCharacterFallback(npcId) });
  }
});

// ============================================
// TEXT-TO-SPEECH ENDPOINT - Uses ElevenLabs
// ============================================
const VOICE_IDS = {
  balaji: 'ErXwobaYiN019PkySvjV',
  jackson: 'VR6AewLTigWG4xSOukaG',
  otavio: 'TxGEqnHWrfWFTfGW9XjX',
  yash: 'pNInz6obpgDQGcFmaJgB',
};

app.post('/api/tts', async (req, res) => {
  const { text, npcId } = req.body;

  if (!ELEVENLABS_API_KEY) {
    return res.status(400).json({ error: 'TTS not configured' });
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
          model_id: 'eleven_turbo_v2_5',
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
      throw new Error(`ElevenLabs error: ${response.status}`);
    }

    // Stream audio back to client
    res.set({
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
    });

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.warn('TTS error:', error.message);
    res.status(500).json({ error: 'TTS failed' });
  }
});

// ============================================
// WEBSOCKET HANDLERS
// ============================================
wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'join':
          playerId = message.player.id;
          players.set(playerId, {
            ...message.player,
            ws
          });

          addLog({
            type: 'join',
            playerId,
            name: message.player.name,
            gender: message.player.gender
          });

          // Send current players to new player
          const currentPlayers = [];
          players.forEach((p, id) => {
            if (id !== playerId) {
              currentPlayers.push({
                id,
                name: p.name,
                gender: p.gender,
                x: p.x || 400,
                y: p.y || 300,
                direction: p.direction || 'down',
                isMoving: false
              });
            }
          });

          ws.send(JSON.stringify({
            type: 'players',
            players: currentPlayers
          }));

          // Notify others
          broadcast(playerId, {
            type: 'player-join',
            player: {
              id: playerId,
              name: message.player.name,
              gender: message.player.gender,
              x: message.player.x || 400,
              y: message.player.y || 300,
              direction: 'down',
              isMoving: false
            }
          });

          console.log(`Player joined: ${message.player.name} (${playerId})`);
          break;

        case 'move':
          if (playerId && players.has(playerId)) {
            const player = players.get(playerId);
            player.x = message.x;
            player.y = message.y;
            player.direction = message.direction;
            player.isMoving = message.isMoving;

            broadcast(playerId, {
              type: 'player-move',
              player: {
                id: playerId,
                name: player.name,
                gender: player.gender,
                x: message.x,
                y: message.y,
                direction: message.direction,
                isMoving: message.isMoving
              }
            });
          }
          break;

        case 'action':
          if (playerId) {
            addLog({
              type: 'action',
              playerId,
              action: message.action,
              data: message.data
            });

            // Broadcast action to others if needed
            if (message.broadcast) {
              broadcast(playerId, {
                type: 'player-action',
                playerId,
                action: message.action,
                data: message.data
              });
            }
          }
          break;

        case 'chat':
          if (playerId && players.has(playerId)) {
            const player = players.get(playerId);
            addLog({
              type: 'chat',
              playerId,
              name: player.name,
              message: message.text
            });

            broadcastAll({
              type: 'chat',
              playerId,
              name: player.name,
              text: message.text
            });
          }
          break;

        case 'npc-chat':
          // Broadcast NPC responses to all players
          broadcastAll({
            type: 'npc-chat',
            npcName: message.npcName,
            text: message.text,
            color: message.color
          });
          break;
      }
    } catch (err) {
      console.error('Message parse error:', err);
    }
  });

  ws.on('close', () => {
    if (playerId) {
      const player = players.get(playerId);
      if (player) {
        addLog({
          type: 'leave',
          playerId,
          name: player.name
        });
        console.log(`Player left: ${player.name} (${playerId})`);
      }
      players.delete(playerId);

      broadcast(playerId, {
        type: 'player-leave',
        playerId
      });
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

// ============================================
// REST ENDPOINTS
// ============================================
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    players: players.size,
    logs: actionLogs.length,
    aiConfigured: !!OPENROUTER_API_KEY,
    ttsConfigured: !!ELEVENLABS_API_KEY
  });
});

app.get('/players', (req, res) => {
  const playerList = [];
  players.forEach((p, id) => {
    playerList.push({
      id,
      name: p.name,
      gender: p.gender,
      x: p.x,
      y: p.y
    });
  });
  res.json(playerList);
});

app.get('/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, MAX_LOGS);
  res.json(actionLogs.slice(-limit));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`AI configured: ${!!OPENROUTER_API_KEY}`);
  console.log(`TTS configured: ${!!ELEVENLABS_API_KEY}`);
});
