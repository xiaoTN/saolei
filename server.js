// server.js — 多边形扫雷联机信令服务器
const { WebSocketServer } = require('ws');
const db = require('./server/db');
db.init();
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

// rooms: code → { host, guest, config, boardInit, hostReady, guestReady }
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
            rooms.set(code, { host: ws, guest: null, config: msg.config || null, boardInit: null, hostReady: false, guestReady: false, createdAt: Date.now(), firstClickAt: null, matchSaved: false });
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

        // 处理 ready-restart：双方都准备好后广播 restart
        if (msg.type === 'ready-restart') {
            const role = ws._role;
            if (role === 'host') fwdRoom.hostReady = true;
            else if (role === 'guest') fwdRoom.guestReady = true;

            const partner = getPartner(fwdRoom, ws);
            send(partner, { type: 'partner-ready-restart' });

            if (fwdRoom.hostReady && fwdRoom.guestReady) {
                // 双方都准备好，广播 restart 并重置状态
                fwdRoom.hostReady = false;
                fwdRoom.guestReady = false;
                fwdRoom.firstClickAt = null;
                fwdRoom.matchSaved = false;
                send(fwdRoom.host, { type: 'restart' });
                send(fwdRoom.guest, { type: 'restart' });
                console.log(`[room] ${fwdCode} restart confirmed`);
            }
            return;
        }

        // 缓存 board-init 消息，记录首次点击时间（first-write-wins）
        if (msg.type === 'board-init') {
            fwdRoom.boardInit = msg;
            if (!fwdRoom.firstClickAt) {
                fwdRoom.firstClickAt = Date.now();
            }
        }

        // 处理 game-over：踩雷方上报，服务端写库
        if (msg.type === 'game-over' && msg.result === 'lose') {
            if (!fwdRoom.matchSaved && fwdRoom.firstClickAt && fwdRoom.config) {
                const winner = ws._role === 'host' ? 'guest' : 'host';
                const duration_seconds = Math.floor((Date.now() - fwdRoom.firstClickAt) / 1000);
                try {
                    db.saveMatch({
                        room_code:        fwdCode,
                        board_type:       String(fwdRoom.config.sides),
                        difficulty:       fwdRoom.config.difficulty || 'custom',
                        rows:             fwdRoom.config.rows,
                        cols:             fwdRoom.config.cols,
                        mines:            fwdRoom.config.mines,
                        winner,
                        duration_seconds,
                        loser_revealed:   msg.revealedCount ?? 0,
                        first_click_at:   fwdRoom.firstClickAt,
                    });
                    fwdRoom.matchSaved = true;
                    console.log(`[db] ${fwdCode} match saved, winner=${winner}, duration=${duration_seconds}s`);
                } catch (e) {
                    console.error('[db] saveMatch failed:', e);
                }
            }
            // 不 return，让 game-over 消息继续向下转发给对方
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
