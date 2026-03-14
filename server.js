// server.js — 多边形扫雷联机信令服务器
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8765;

const MIME = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.png':  'image/png',
    '.ico':  'image/x-icon',
};

// 简单速率限制：每个 IP 每 5 秒最多 10 次 /api/rooms 请求
const _rateMap = new Map();
function checkRateLimit(ip) {
    const now = Date.now();
    const entry = _rateMap.get(ip) || { count: 0, resetAt: now + 5000 };
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 5000; }
    entry.count++;
    _rateMap.set(ip, entry);
    return entry.count <= 10;
}

const httpServer = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];

    // 房间列表 API：返回等待中（只有 host，guest 未加入）的房间
    if (urlPath === '/api/rooms') {
        const ip = req.socket.remoteAddress || 'unknown';
        if (!checkRateLimit(ip)) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Too Many Requests' }));
            return;
        }
        const list = [];
        for (const [code, room] of rooms) {
            if (room.host && !room.guest) {
                list.push({ code, config: room.config || {}, createdAt: room.createdAt });
            }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(list));
        return;
    }

    const filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
    const ext = path.extname(filePath);
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

const wss = new WebSocketServer({ server: httpServer });

// rooms: code → { host: ws|null, guest: ws|null, config: obj|null, boardInit: msg|null }
const rooms = new Map();

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
        code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (rooms.has(code));
    return code;
}

function send(ws, data) {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
}

function getPartner(room, ws) {
    if (room.host === ws) return room.guest;
    if (room.guest === ws) return room.host;
    return null;
}

function getRoomByWs(ws) {
    for (const [code, room] of rooms) {
        if (room.host === ws || room.guest === ws) return { code, room };
    }
    return null;
}

wss.on('connection', (ws) => {
    console.log('[ws] client connected');

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'create') {
            const code = generateCode();
            rooms.set(code, { host: ws, guest: null, config: msg.config || null, boardInit: null, createdAt: Date.now() });
            ws._roomCode = code;
            ws._role = 'host';
            send(ws, { type: 'room-created', code, role: 'host' });
            console.log(`[room] ${code} created`);
            return;
        }

        if (msg.type === 'join') {
            const code = (msg.code || '').toUpperCase().trim();
            if (!/^[A-Z0-9]{4}$/.test(code)) {
                send(ws, { type: 'error', code: 'INVALID_CODE' }); return;
            }
            const room = rooms.get(code);
            if (!room) {
                send(ws, { type: 'error', code: 'ROOM_NOT_FOUND' }); return;
            }

            // 房间已满
            if (room.host && room.guest) {
                send(ws, { type: 'error', code: 'ROOM_FULL' }); return;
            }

            // 正常加入
            if (room.host && !room.guest) {
                room.guest = ws;
                ws._roomCode = code;
                ws._role = 'guest';
                const config = room.config || {};
                send(ws, { type: 'room-joined', code, role: 'guest', config });
                send(room.host, { type: 'partner-joined' });
                console.log(`[room] ${code} guest joined`);
                return;
            }

        }  // end if (msg.type === 'join')

        // 转发消息给对方
        const entry = getRoomByWs(ws);
        if (!entry) return;
        const { code: fwdCode, room: fwdRoom } = entry;

        // 缓存 board-init 消息
        if (msg.type === 'board-init') {
            fwdRoom.boardInit = msg;
        }

        const partner = getPartner(fwdRoom, ws);
        send(partner, msg);
    });

    ws.on('close', () => {
        const entry = getRoomByWs(ws);
        if (!entry) return;
        const { code, room } = entry;
        const partner = getPartner(room, ws);

        send(partner, { type: 'partner-left' });
        rooms.delete(code);
        console.log(`[room] ${code} destroyed (player disconnected)`);
    });
});

httpServer.listen(PORT, '0.0.0.0', () => {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const lanIps = [];
    for (const iface of Object.values(nets)) {
        for (const net of iface) {
            if (net.family === 'IPv4' && !net.internal) lanIps.push(net.address);
        }
    }
    console.log(`[server] listening on http://localhost:${PORT}`);
    lanIps.forEach(ip => console.log(`[server] LAN: http://${ip}:${PORT}`));
    console.log(`[server] WebSocket on ws://0.0.0.0:${PORT}`);
});
