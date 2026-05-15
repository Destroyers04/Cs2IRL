import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import api from "../lib/api";
import socket from "../lib/socket";
import { getUser } from "../lib/auth";
import BombTimer from "../components/BombTimer";

export default function Bomb() {
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const currentUser = getUser();

  async function fetchMatch() {
    try {
      const apiResponse = await api.get("/match");
      setMatchData(apiResponse.data);
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
    }

    socket.on("match:state", handleMatchState);
    return () => {
      socket.off("match:state", handleMatchState);
    };
  }, []);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#F5F6FA" }}
      >
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const currentMatch = matchData?.match;
  const matchStatus = currentMatch?.status;
  const plantCode = currentMatch?.plant_code;
  const bombExplodeAt = currentMatch?.bomb_explode_time;
  const isBombHolder = currentMatch?.bomb_holder_id === currentUser?.id;

  if (!isBombHolder) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#F5F6FA" }}
      >
        <div className="text-center">
          <div className="text-red-500 mb-4">Access denied</div>
          <button
            onClick={() => navigate("/lobby")}
            className="px-4 py-3 text-sm font-semibold"
            style={{
              backgroundColor: "#F4762A",
              color: "#fff",
              border: "none",
            }}
          >
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  if (matchStatus === "active") {
    return <Navigate to="/plant" replace />;
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#F5F6FA" }}
    >
      {(matchStatus === "defused" || matchStatus === "exploded") && (
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => navigate("/lobby")}
            className="text-sm font-semibold px-3 py-2"
            style={{ backgroundColor: "#F4762A", color: "#fff", border: "none" }}
          >
            Lobby
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8">
        {matchStatus === "planted" && (
          <>
            <div
              className="w-full text-center px-4 py-4 font-bold text-2xl"
              style={{
                backgroundColor: "#431407",
                color: "#f97316",
                border: "1px solid #7c2d12",
                fontFamily: "Montserrat, sans-serif",
              }}
            >
              Bomb planted
            </div>

            <div className="text-center">
              <div className="text-sm text-gray-500 mb-3">Defuse code</div>
              <div
                className="text-8xl font-bold font-mono"
                style={{ color: "#0B1F4A", letterSpacing: "0.15em" }}
              >
                {plantCode || "----"}
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-gray-500 mb-4">Time remaining</div>
              <BombTimer explodeAt={bombExplodeAt} />
            </div>
          </>
        )}

        {matchStatus === "defused" && (
          <div className="text-center">
            <div
              className="text-2xl font-bold mb-2"
              style={{ color: "#3b82f6", fontFamily: "Montserrat, sans-serif" }}
            >
              Bomb defused
            </div>
            <div className="text-gray-400 text-sm mt-1">Counter-Terrorists win</div>
          </div>
        )}

        {matchStatus === "exploded" && (
          <div className="text-center">
            <div
              className="text-2xl font-bold mb-2"
              style={{ color: "#ef4444", fontFamily: "Montserrat, sans-serif" }}
            >
              Bomb exploded
            </div>
            <div className="text-gray-400 text-sm mt-1">Terrorists win</div>
          </div>
        )}
      </div>
    </div>
  );
}
