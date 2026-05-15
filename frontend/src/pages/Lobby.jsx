import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import socket from "../lib/socket";
import { getUser, clearToken } from "../lib/auth";
import PlayerCard from "../components/PlayerCard";
import BombTimer from "../components/BombTimer";
import { User, LogOut, MoveRight } from "lucide-react";

export default function Lobby() {
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [showDeadModal, setShowDeadModal] = useState(false);
  const navigate = useNavigate();
  const currentUser = getUser();

  async function fetchMatch() {
    try {
      const apiResponse = await api.get("/match");
      setMatchData(apiResponse.data);
    } catch (requestError) {
      if (requestError.response?.status === 404) {
        setMatchData(null);
      } else {
        setFetchError("Failed to load match data.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMatch();

    function handleMatchState(matchStateData) {
      setMatchData(matchStateData);
      setLoading(false);
    }

    socket.on("match:state", handleMatchState);
    return () => {
      socket.off("match:state", handleMatchState);
    };
  }, []);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  async function confirmMarkDead() {
    try {
      await api.post("/game/mark-dead");
      setShowDeadModal(false);
    } catch (requestError) {
      console.error(requestError.response?.data?.error || "Error.");
      setShowDeadModal(false);
    }
  }

  const currentMatch = matchData?.match;
  const allPlayers = matchData?.players || [];
  const matchStatus = currentMatch?.status;
  const isBombHolder = currentMatch?.bomb_holder_id === currentUser?.id;
  const bombExplodeAt = currentMatch?.bomb_explode_time;
  const matchEndAt = currentMatch?.match_end_time;

  const myPlayerEntry = allPlayers.find((p) => p.id === currentUser?.id);
  const isAlive = !!myPlayerEntry && myPlayerEntry.is_alive !== 0;
  const myTeam = myPlayerEntry?.team;

  const statusLabels = {
    lobby: "Lobby — waiting for players",
    active: "Round in progress",
    planted: "Bomb has been planted",
    defused: "Bomb has been defused",
    exploded: "Bomb has exploded",
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#F5F6FA" }}
    >
      {showDeadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
        >
          <div
            className="mx-4 p-6 max-w-sm w-full"
            style={{ backgroundColor: "#F5F6FA" }}
          >
            <div
              className="text-lg font-bold mb-2"
              style={{
                color: "#0B1F4A",
                fontFamily: "Montserrat, sans-serif",
              }}
            >
              Confirm death
            </div>
            <div className="text-sm text-gray-600 mb-6">
              Are you dead? This cannot be undone.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeadModal(false)}
                className="flex-1 py-3 text-sm font-semibold"
                style={{
                  backgroundColor: "#374151",
                  color: "#fff",
                  border: "none",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmMarkDead}
                className="flex-1 py-3 text-sm font-semibold"
                style={{
                  backgroundColor: "#C0392B",
                  color: "#fff",
                  border: "none",
                }}
              >
                I am dead
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex gap-2 items-center">
          <img
            className="w-5 h-5 rounded-sm"
            src="/Cs2-icon.jpg"
            alt="Cs2 Icon"
          />
          <div
            className="text-lg font-bold uppercase"
            style={{
              color: "#0B1F4A",
              fontFamily: "Montserrat, sans-serif",
            }}
          >
            CS2 IRL
          </div>
        </div>
        <div className="flex gap-2">
          {currentUser?.is_admin === 1 && (
            <button
              onClick={() => navigate("/admin")}
              className="px-3 py-2 text-xs font-semibold rounded-sm"
              style={{
                backgroundColor: "#F4762A",
                color: "#fff",
                border: "none",
              }}
            >
              Admin
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-sm"
            style={{
              backgroundColor: "#C0392B",
              color: "#fff",
              border: "none",
            }}
          >
            <span>Log out</span>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 pt-2 pb-3 pl-4">
        <div className="text-black bg-gray-300 rounded-full p-1">
          <User className="w-4 h-4" />
        </div>
        <div className="text-sm text-black">{currentUser?.username}</div>
      </div>

      {currentMatch && (
        <div
          className="px-4 py-2 text-center text-sm font-semibold"
          style={{
            backgroundColor: "#1A3468",
            color: "#fff",
          }}
        >
          {statusLabels[matchStatus] || matchStatus}
          {matchStatus === "active" && matchEndAt && (
            <div className="mt-2">
              <BombTimer explodeAt={matchEndAt} />
            </div>
          )}
          {matchStatus === "planted" && bombExplodeAt && (
            <div className="mt-2">
              <BombTimer explodeAt={bombExplodeAt} />
            </div>
          )}
        </div>
      )}

      <div className="flex-1 px-4 py-4">
        {loading && (
          <div className="text-center text-black py-10">Loading...</div>
        )}

        {!loading && fetchError && (
          <div className="text-red-400 text-sm text-center py-4">
            {fetchError}
          </div>
        )}

        {!loading && !fetchError && !currentMatch && (
          <div className="text-center py-10">
            <div className="text-gray-500 text-sm">
              Waiting for admin to start the match...
            </div>
          </div>
        )}

        {!loading && currentMatch && (
          <>
            {isBombHolder && matchStatus === "active" && (
              <div
                className="mb-4 px-4 py-4 text-center font-bold text-lg"
                style={{
                  backgroundColor: "#F4762A",
                  color: "#fff",
                  fontFamily: "Montserrat, sans-serif",
                }}
              >
                You have the bomb
              </div>
            )}

            {matchStatus === "defused" && (
              <div
                className="mb-4 px-4 py-4 text-center font-bold text-xl"
                style={{
                  backgroundColor: "#1e3a5f",
                  color: "#60a5fa",
                  border: "1px solid #3b82f6",
                  fontFamily: "Montserrat, sans-serif",
                }}
              >
                Bomb defused — Counter-Terrorists win
              </div>
            )}
            {matchStatus === "exploded" && (
              <div
                className="mb-4 px-4 py-4 text-center font-bold text-xl"
                style={{
                  backgroundColor: "#450a0a",
                  color: "#f87171",
                  border: "1px solid #ef4444",
                  fontFamily: "Montserrat, sans-serif",
                }}
              >
                Terrorists win
              </div>
            )}

            <div className="mb-4" style={{ border: "1px solid #0B1F4A" }}>
              <div
                className="px-4 py-2 text-sm font-bold"
                style={{
                  backgroundColor: "#0B1F4A",
                  color: "#fff",
                  fontFamily: "Montserrat, sans-serif",
                }}
              >
                Players ({allPlayers.length})
              </div>
              {allPlayers.length === 0 && (
                <div className="px-4 py-4 text-sm text-gray-500">
                  No players in the match.
                </div>
              )}
              {allPlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  currentMatch={currentMatch}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {isBombHolder && matchStatus === "active" && (
                <button
                  onClick={() => navigate("/plant")}
                  className="w-full py-5 text-base font-bold"
                  style={{
                    backgroundColor: "#f97316",
                    color: "#fff",
                    border: "none",
                    fontFamily: "Montserrat, sans-serif",
                  }}
                >
                  Plant bomb <MoveRight className="w-4 h-4 inline" />
                </button>
              )}

              {myTeam === "ct" && isAlive && matchStatus === "planted" && (
                <button
                  onClick={() => navigate("/defuse")}
                  className="w-full py-5 text-base font-bold"
                  style={{
                    backgroundColor: "#f97316",
                    color: "#fff",
                    border: "none",
                    fontFamily: "Montserrat, sans-serif",
                  }}
                >
                  Defuse bomb <MoveRight className="w-4 h-4 inline" />
                </button>
              )}

              {(matchStatus === "active" || matchStatus === "planted") &&
                isAlive &&
                myPlayerEntry && (
                  <button
                    onClick={() => setShowDeadModal(true)}
                    className="flex items-center justify-center gap-2 w-full py-3 text-sm font-semibold rounded-sm"
                    style={{
                      backgroundColor: "#C0392B",
                      color: "#fff",
                      border: "none",
                    }}
                  >
                    Mark as dead
                  </button>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
