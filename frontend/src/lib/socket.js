import { io } from 'socket.io-client';

const socket = io({
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

export function connectSocket(authToken) {
  socket.connect();
  socket.on('connect', () => {
    socket.emit('player:join', { token: authToken });
  });
}

export default socket;
