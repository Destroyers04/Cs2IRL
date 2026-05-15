import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './lib/auth';
import { connectSocket } from './lib/socket';
import socket from './lib/socket';

import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Lobby from './pages/Lobby';
import Admin from './pages/Admin';
import Match from './pages/Match';
import Bomb from './pages/Bomb';
import Plant from './pages/Plant';
import Defuse from './pages/Defuse';

export default function App() {
  useEffect(() => {
    const storedToken = getToken();
    if (storedToken) {
      connectSocket(storedToken);
    }
  }, []);

  // Unlock audio on first tap — required for iOS Safari
  useEffect(() => {
    function unlock() {
      const silent = new Audio('/sounds/bomb_planted.mp3');
      silent.volume = 0;
      silent.play().catch(() => {});
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    }
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
  }, []);

  useEffect(() => {
    function handlePlanted() {
      new Audio('/sounds/bomb_planted.mp3').play().catch(() => {});
    }
    function handleDefused() {
      new Audio('/sounds/defused_win.mp3').play().catch(() => {});
    }
    function handleExploded() {
      new Audio('/sounds/explode_win.mp3').play().catch(() => {});
    }
    socket.on('match:planted', handlePlanted);
    socket.on('match:defused', handleDefused);
    socket.on('match:exploded', handleExploded);
    return () => {
      socket.off('match:planted', handlePlanted);
      socket.off('match:defused', handleDefused);
      socket.off('match:exploded', handleExploded);
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/lobby"
          element={<ProtectedRoute><Lobby /></ProtectedRoute>}
        />
        <Route
          path="/admin"
          element={<ProtectedRoute><Admin /></ProtectedRoute>}
        />
        <Route
          path="/match"
          element={<ProtectedRoute><Match /></ProtectedRoute>}
        />
        <Route
          path="/bomb"
          element={<ProtectedRoute><Bomb /></ProtectedRoute>}
        />
        <Route
          path="/plant"
          element={<ProtectedRoute><Plant /></ProtectedRoute>}
        />
        <Route
          path="/defuse"
          element={<ProtectedRoute><Defuse /></ProtectedRoute>}
        />
        <Route path="/" element={<Navigate to="/lobby" replace />} />
        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
