import {createHash} from 'node:crypto';
import type {IncomingMessage} from 'node:http';
import type {Duplex} from 'node:stream';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export type TextSock = {
 send: (text: string) => void;
 close: () => void;
};

export function acceptWebsocket(req: IncomingMessage, socket: Duplex, onText: (text: string) => void, onClose: () => void): TextSock | null {
 const key = req.headers['sec-websocket-key'];
 if (typeof key !== 'string') return null;
 const accept = createHash('sha1').update(key + GUID).digest('base64');
 socket.write(
  `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
 );
 let closed = false;
 const fail = () => {
  if (closed) return;
  closed = true;
  onClose();
 };
 socket.on('error', fail);
 socket.on('end', fail);
 socket.on('close', fail);
 let buf = Buffer.alloc(0);
 socket.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  while (buf.length >= 2) {
   const fin = (buf[0] & 0x80) !== 0;
   const op = buf[0] & 0x0f;
   const masked = (buf[1] & 0x80) !== 0;
   let len = buf[1] & 0x7f;
   let off = 2;
   if (len === 126) {
    if (buf.length < 4) return;
    len = buf.readUInt16BE(2);
    off = 4;
   } else if (len === 127) return;
   const maskOff = off;
   const dataOff = off + (masked ? 4 : 0);
   if (buf.length < dataOff + len) return;
   let payload = buf.subarray(dataOff, dataOff + len);
   if (masked) {
    const mask = buf.subarray(maskOff, maskOff + 4);
    const out = Buffer.alloc(len);
    for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
    payload = out;
   }
   buf = buf.subarray(dataOff + len);
   if (op === 8) {
    fail();
    return;
   }
   if (op === 1 && fin) onText(payload.toString('utf8'));
  }
 });
 return {
  send(text) {
   if (closed) return;
   const data = Buffer.from(text, 'utf8');
   const head = data.length < 126
    ? Buffer.from([0x81, data.length])
    : Buffer.concat([Buffer.from([0x81, 126]), Buffer.from([(data.length >> 8) & 255, data.length & 255])]);
   socket.write(Buffer.concat([head, data]));
  },
  close() {
   if (closed) return;
   closed = true;
   try { socket.end(); } catch {}
   onClose();
  },
 };
}
