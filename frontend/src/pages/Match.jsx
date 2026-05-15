import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import socket from '../lib/socket';
import { getUser } from '../lib/auth';
import BombTimer from '../components/BombTimer';
import PlayerCard from '../components/PlayerCard';

export default function Match() {
  const [matchData, setMatchData] = useState(null);
  const [bombExplodeAt, setBombExplodeAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const currentUser = getUser();

  async function fetchMatch() {
    try {
      const apiResponse = await api.get('/match');
      setMatchData(apiResponse.data);
      if (apiResponse.data?.match?.bomb_explode_time) {
        setBombExplodeAt(apiResponse.data.match.bomb_explode_time);
      }
    } catch {
      setMatchData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMatch();

    function handleMatchState(matchStateData) {
      setMatchData(matchStateData);
      if (matchStateData?.match?.bomb_explode_time) {
        setBombExplodeAt(matchStateData.match.bomb_explode_time);
      }
    }

    function handlePlanted(plantedEventData) {
      if (plantedEventData?.explode_at) setBombExplodeAt(plantedEventData.explode_at);
    }

    socket.on('match:state', handleMatchState);
    socket.on('match:planted', handlePlanted);

    return () => {
      socket.off('match:state', handleMatchState);
      socket.off('match:planted', handlePlanted);
    };
  }, []);

  async function markDead() {
    try {
      await api.post('/game/mark-dead');
    } catch (requestError) {
      console.error(requestError.response?.data?.error || 'Error.');
    }
  }

  const currentMatch = matchData?.match;
  const allPlayers = matchData?.players || [];
  const matchStatus = currentMatch?.status;

  const myPlayerEntry = allPlayers.find(player => player.id === currentUser?.id);
  const isBombHolder = currentMatch?.bomb_holder_id === currentUser?.id;
  const isAlive = !!myPlayerEntry && myPlayerEntry.is_alive !== 0;
  const myTeam = myPlayerEntry?.team;
  const matchEndAt = currentMatch?.match_end_time;

  const statusColors = {
    lobby: '#6b7280',
    active: '#16a34a',
    planted: '#c2410c',
    defused: '#2563eb',
    exploded: '#dc2626',
  };

  const statusLabels = {
    lobby: 'Lobby',
    active: 'Match active',
    planted: 'Bomb planted',
    defused: 'Bomb defused',
    exploded: 'Bomb exploded',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F6FA' }}>
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F6FA' }}>
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid #e5e7eb' }}
      >
        <button
          onClick={() => navigate('/lobby')}
          className="text-sm font-semibold px-3 py-2"
          style={{ backgroundColor: '#F4762A', color: '#fff', border: 'none' }}
        >
          Lobby
        </button>
        <div
          className="text-sm font-bold"
          style={{ color: statusColors[matchStatus] || '#6b7280', fontFamily: 'Montserrat, sans-serif' }}
        >
          {statusLabels[matchStatus] || (matchStatus || 'No match')}
        </div>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4">
        {!currentMatch && (
          <div className="text-center text-gray-500 py-10">No active match.</div>
        )}

        {currentMatch && (
          <>
            {matchStatus === 'defused' && (
              <div
                className="py-8 text-center font-bold"
                style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}
              >
                <div
                  className="text-2xl text-blue-600 mb-1"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  Bomb defused
                </div>
                <div className="text-gray-600 text-sm mt-1">Counter-Terrorists win</div>
              </div>
            )}
            {matchStatus === 'exploded' && (
              <div
                className="py-8 text-center font-bold"
                style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}
              >
                <div
                  className="text-2xl text-red-600 mb-1"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  Bomb exploded
                </div>
                <div className="text-gray-600 text-sm mt-1">Terrorists win</div>
              </div>
            )}

            {matchStatus === 'active' && matchEndAt && (
              <div
                className="py-6 text-center"
                style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}
              >
                <div className="text-sm text-green-700 mb-3">Round time remaining</div>
                <BombTimer explodeAt={matchEndAt} />
              </div>
            )}

            {matchStatus === 'planted' && bombExplodeAt && (
              <div
                className="py-6 text-center"
                style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}
              >
                <div className="text-sm text-orange-600 mb-3">Bomb timer</div>
                <BombTimer explodeAt={bombExplodeAt} />
              </div>
            )}

            {isBombHolder && (
              <div
                className="px-4 py-3 font-bold text-center"
                style={{ backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', fontFamily: 'Montserrat, sans-serif' }}
              >
                You have the bomb
              </div>
            )}

            {isBombHolder && matchStatus === 'active' && (
              <button
                onClick={() => navigate('/plant')}
                className="w-full py-5 font-bold text-base"
                style={{ backgroundColor: '#f97316', color: '#fff', border: 'none', fontFamily: 'Montserrat, sans-serif' }}
              >
                Go plant
              </button>
            )}
            {isBombHolder && matchStatus === 'planted' && (
              <button
                onClick={() => navigate('/bomb')}
                className="w-full py-5 font-bold text-base pulse-red"
                style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', fontFamily: 'Montserrat, sans-serif' }}
              >
                View bomb timer
              </button>
            )}
            {myTeam === 'ct' && isAlive && matchStatus === 'planted' && (
              <button
                onClick={() => navigate('/defuse')}
                className="w-full py-5 font-bold text-base"
                style={{ backgroundColor: '#1d4ed8', color: '#fff', border: 'none', fontFamily: 'Montserrat, sans-serif' }}
              >
                Defuse now
              </button>
            )}

            {myPlayerEntry && isAlive && (matchStatus === 'active' || matchStatus === 'planted') && (
              <button
                onClick={markDead}
                className="w-full py-4 font-semibold text-sm"
                style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}
              >
                Mark myself as dead
              </button>
            )}

            <div style={{ border: '1px solid #e5e7eb' }}>
              <div
                className="px-4 py-2 text-sm font-bold"
                style={{ backgroundColor: '#f9fafb', color: '#374151', borderBottom: '1px solid #e5e7eb', fontFamily: 'Montserrat, sans-serif' }}
              >
                Players
              </div>
              {allPlayers.map(player => (
                <PlayerCard key={player.id} player={player} currentMatch={currentMatch} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
