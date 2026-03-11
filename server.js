// server.js — 多边形扫雷联机信令服务器
const { WebSocketServer } = require('ws');

const PORT = 8765;
const wss = new WebSocketServer({ port: PORT });

// rooms: code → { host: ws|null, guest: ws|null, boardInit: msg|null, reconnectTimer: id|null }
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

function scheduleRoomDestroy(code) {
    const room = rooms.get(code);
    if (!room) return;
    if (room.reconnectTimer) clearTimeout(room.reconnectTimer);
    room.reconnectTimer = setTimeout(() => {
        const r = rooms.get(code);
        if (!r) return;
        // 通知留守方
        const survivor = r.host || r.guest;
        send(survivor, { type: 'room-destroyed' });
        rooms.delete(code);
        console.log(`[room] ${code} destroyed after timeout`);
    }, 30000);
}

wss.on('connection', (ws) => {
    console.log('[ws] client connected');

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'create') {
            const code = generateCode();
            rooms.set(code, { host: ws, guest: null, config: msg.config || null, boardInit: null, reconnectTimer: null });
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

            // 断线重连：host 槽位空（guest 留守，等待 host 重连）
            if (!room.host && room.guest) {
                if (room.reconnectTimer) clearTimeout(room.reconnectTimer);
                room.reconnectTimer = null;
                room.host = ws;
                ws._roomCode = code;
                ws._role = 'host';
                send(ws, { type: 'room-joined', code, role: 'host', config: room.config || {} });
                if (room.boardInit) send(ws, room.boardInit);
                send(room.guest, { type: 'partner-rejoined' });
                console.log(`[room] ${code} host reconnected`);
                return;
            }

            // 房间已满
            if (room.host && room.guest) {
                send(ws, { type: 'error', code: 'ROOM_FULL' }); return;
            }

            // 正常加入 / guest 断线重连（host 在，guest 槽位空）
            if (room.host && !room.guest) {
                if (room.reconnectTimer) clearTimeout(room.reconnectTimer);
                room.reconnectTimer = null;
                room.guest = ws;
                ws._roomCode = code;
                ws._role = 'guest';
                const config = room.config || {};
                send(ws, { type: 'room-joined', code, role: 'guest', config });
                if (room.boardInit) {
                    // 有 boardInit 说明是断线重连，发 partner-rejoined
                    send(ws, room.boardInit);
                    send(room.host, { type: 'partner-rejoined' });
                    console.log(`[room] ${code} guest reconnected`);
                } else {
                    send(room.host, { type: 'partner-joined' });
                    console.log(`[room] ${code} guest joined`);
                }
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

        if (room.host === ws) room.host = null;
        else if (room.guest === ws) room.guest = null;

        send(partner, { type: 'partner-left' });
        scheduleRoomDestroy(code);
        console.log(`[room] ${code} a player disconnected`);
    });
});

console.log(`[server] listening on ws://localhost:${PORT}`);
