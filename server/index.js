import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Store connected players
const players = new Map();

// Store action logs (last 1000)
const actionLogs = [];
const MAX_LOGS = 1000;

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

// REST endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    players: players.size,
    logs: actionLogs.length
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
});
