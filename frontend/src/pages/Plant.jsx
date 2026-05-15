import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { getUser } from "../lib/auth";
import SequenceGame from "../components/SequenceGame";
import { MoveLeft } from "lucide-react";

export default function Plant() {
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState("idle"); // idle | playing | success
  const [plantSequence, setPlantSequence] = useState(null);
  const [plantTimerSeconds, setPlantTimerSeconds] = useState(15);
  const [arrowTimeSeconds, setArrowTimeSeconds] = useState(2);
  const [maxPlantErrors, setMaxPlantErrors] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const currentUser = getUser();

  useEffect(() => {
    async function init() {
      try {
        const apiResponse = await api.get("/match");
        setMatchData(apiResponse.data);
        const match = apiResponse.data?.match;
        setPlantTimerSeconds(match?.plant_timer_seconds ?? 15);
        setArrowTimeSeconds(match?.arrow_time_seconds ?? 2);
        setMaxPlantErrors(match?.max_plant_errors ?? 3);
        const user = getUser();
        if (match?.status === "active" && match?.bomb_holder_id === user?.id) {
          try {
            const seqResponse = await api.post("/game/plant/start");
            setPlantSequence(seqResponse.data.sequence);
            setPhase("playing");
            new Audio("/sounds/plant_start.mp3").play().catch(() => {});
          } catch (seqError) {
            setErrorMessage(
              seqError.response?.data?.error || "Failed to start planting.",
            );
          }
        }
      } catch {
        setMatchData(null);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function startPlanting() {
    setErrorMessage("");
    try {
      const apiResponse = await api.post("/game/plant/start");
      setPlantSequence(apiResponse.data.sequence);
      setPhase("playing");
      new Audio("/sounds/plant_start.mp3").play().catch(() => {});
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.error || "Failed to start planting.",
      );
    }
  }

  function handleFail() {
    setPhase("idle");
    setPlantSequence(null);
    setErrorMessage("Too many errors or timed out — try again.");
  }

  async function handleComplete() {
    setSubmitting(true);
    setPhase("success");
    try {
      await api.post("/game/plant/complete", { errors: 0 });
      navigate("/bomb");
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.error || "Failed to complete plant.",
      );
      setPhase("idle");
    } finally {
      setSubmitting(false);
    }
  }

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
  const isBombHolder = currentMatch?.bomb_holder_id === currentUser?.id;

  if (!isBombHolder || currentMatch?.status !== "active") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#F5F6FA" }}
      >
        <div className="text-center">
          <div className="text-red-500 mb-4">Not authorized</div>
          <button
            onClick={() => navigate("/lobby")}
            className="px-4 py-3 text-sm font-semibold"
            style={{ backgroundColor: "#F4762A", color: "#fff", border: "none" }}
          >
            <MoveLeft className="w-3 h-4 inline" /> Back to lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#F5F6FA" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid #e5e7eb" }}
      >
        <button
          onClick={() => navigate("/lobby")}
          className="text-sm font-semibold px-3 py-2"
          style={{ backgroundColor: "#F4762A", color: "#fff", border: "none" }}
        >
          <MoveLeft className="w-3 h-4 inline" /> Back
        </button>
        <div
          className="text-sm font-bold"
          style={{ color: "#0B1F4A", fontFamily: "Montserrat, sans-serif" }}
        >
          Plant bomb
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6">
        {phase === "playing" && plantSequence && (
          <>
            <div className="text-center mb-2">
              <div
                className="text-lg font-bold"
                style={{ color: "#0B1F4A", fontFamily: "Montserrat, sans-serif" }}
              >
                Planting...
              </div>
              <div className="text-gray-500 text-sm mt-1">
                Keep pressing arrows until the timer runs out
              </div>
            </div>

            <SequenceGame
              sequence={plantSequence}
              duration={plantTimerSeconds}
              arrowTime={arrowTimeSeconds}
              maxErrors={maxPlantErrors}
              onComplete={handleComplete}
              onFail={handleFail}
            />
          </>
        )}

        {phase === "success" && (
          <div className="text-center">
            <div
              className="text-xl font-bold"
              style={{ color: "#16a34a", fontFamily: "Montserrat, sans-serif" }}
            >
              {submitting ? "Planting..." : "Planted!"}
            </div>
          </div>
        )}

        {phase === "idle" && (
          <>
            {errorMessage && (
              <div
                className="w-full px-3 py-2 text-sm text-center"
                style={{
                  backgroundColor: "#fef2f2",
                  color: "#dc2626",
                  border: "1px solid #fca5a5",
                }}
              >
                {errorMessage}
              </div>
            )}
            <button
              onClick={startPlanting}
              className="w-full py-5 font-bold text-base"
              style={{
                backgroundColor: "#F4762A",
                color: "#fff",
                border: "none",
                fontFamily: "Montserrat, sans-serif",
              }}
            >
              {errorMessage ? "Try again" : "Start planting"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
