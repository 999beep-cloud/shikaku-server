const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { router, setBroadcast } = require('./routes/score');
const { redis } = require('./db/redis');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Shikaku server is running'));
app.use('/api/score', router);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = new Set();
wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
});

setBroadcast((top10) => {
    const payload = JSON.stringify({ type: 'leaderboard_update', data: top10 });
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
});

// 每天清除前一天的舊資料（釋放Redis記憶體）
setInterval(async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    await redis.del(`leaderboard:daily:${yesterday}`);
}, 1000 * 60 * 60); // 每小時檢查一次

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
