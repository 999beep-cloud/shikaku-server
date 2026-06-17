const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

function getTodayKey() {
    const today = new Date().toISOString().split('T')[0];
    return `leaderboard:daily:${today}`;
}

module.exports = { redis, getTodayKey };
