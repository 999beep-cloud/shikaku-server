const express = require('express');
const router = express.Router();
const { redis, getTodayKey } = require('../db/redis');

let broadcastFn = null;
function setBroadcast(fn) { broadcastFn = fn; }

router.post('/submit', async (req, res) => {
    try {
        const { user_id, username, streak, mode } = req.body;

        if (!user_id || !username || streak === undefined || mode !== 'rank') {
            return res.json({ success: true, ranked: false });
        }

        if (streak < 0) {
            return res.status(400).json({ error: 'invalid_streak' });
        }

        const key = getTodayKey();

        const current = await redis.zscore(key, user_id);
        if (current === null || streak > parseInt(current)) {
            await redis.zadd(key, streak, user_id);
        }

        await redis.hset(`user_meta:${user_id}`, 'username', username);
        await redis.expire(key, 60 * 60 * 26);

        const rank = await redis.zrevrank(key, user_id);
        const top10 = await getTop10();
        if (broadcastFn) broadcastFn(top10);

        res.json({ success: true, ranked: true, rank: rank + 1 });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'server_error' });
    }
});

async function getTop10() {
    const key = getTodayKey();
    const raw = await redis.zrevrange(key, 0, 9, 'WITHSCORES');
    const result = [];
    for (let i = 0; i < raw.length; i += 2) {
        const user_id = raw[i];
        const score = raw[i + 1];
        const username = await redis.hget(`user_meta:${user_id}`, 'username');
        result.push({ rank: i / 2 + 1, user_id, username, streak: parseInt(score) });
    }
    return result;
}

router.get('/leaderboard', async (req, res) => {
    try {
        const top10 = await getTop10();
        res.json(top10);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'server_error' });
    }
});

module.exports = { router, setBroadcast };
