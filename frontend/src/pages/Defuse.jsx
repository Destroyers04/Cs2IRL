import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { getUser } from "../lib/auth";
import SequenceGame from "../components/SequenceGame";
import BombTimer from "../components/BombTimer";
import { MoveLeft } from "lucide-react";

export default function Defuse() {
  const [matchData, setMatchData] = useState(null);
  const [bombExplodeAt, setBombExplodeAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState("idle"); // idle | code | playing | success
  const [defuseSequence, setDefuseSequence] = useState(null);
  const [defuseTimerSeconds, setDefuseTimerSeconds] = useState(10);
  const [arrowTimeSeconds, setArrowTimeSeconds] = useState(2);
  const [maxDefuseErrors, setMaxDefuseErrors] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [codeDigits, setCodeDigits] = useState(["", "", "", ""]);
  const [codeError, setCodeError] = useState("");
  const digitRefs = [useRef(), useRef(), useRef(), useRef()];
  const navigate = useNavigate();
  const currentUser = getUser();

  useEffect(() => {
    async function fetchMatch() {
      try {
        const apiResponse = await api.get("/match");
        setMatchData(apiResponse.data);
        setDefuseTimerSeconds(apiResponse.data?.match?.defuse_timer_seconds ?? 10);
        setArrowTimeSeconds(apiResponse.data?.match?.arrow_time_seconds ?? 2);
        setMaxDefuseErrors(apiResponse.data?.match?.max_defuse_errors ?? 3);
        if (apiResponse.data?.match?.bomb_explode_time) {
          setBombExplodeAt(apiResponse.data.match.bomb_explode_time);
        }
      } catch {
        setMatchData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchMatch();
  }, []);

  function handleFail() {
    setPhase("idle");
    setDefuseSequence(null);
    setErrorMessage("Too many errors or timed out — try again.");
  }

  function handleStartDefusing() {
    setErrorMessage("");
    setCodeDigits(["", "", "", ""]);
    setCodeError("");
    setPhase("code");
    setTimeout(() => digitRefs[0].current?.focus(), 50);
  }

  function handleDigitChange(index, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...codeDigits];
    next[index] = digit;
    setCodeDigits(next);
    setCodeError("");
    if (digit && index < 3) {
      digitRefs[index + 1].current?.focus();
    }
  }

  function handleDigitKeyDown(index, e) {
    if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
      digitRefs[index - 1].current?.focus();
    }
  }

  async function handleCodeSubmit() {
    const entered = codeDigits.join("");
    const correct = String(currentMatch?.plant_code ?? "");
    if (entered.length < 4) {
      setCodeError("Enter all 4 digits.");
      return;
    }
    if (entered !== correct) {
      setCodeError("Wrong code — check the bomb carrier's screen.");
      setCodeDigits(["", "", "", ""]);
      setTimeout(() => digitRefs[0].current?.focus(), 50);
      return;
    }
    setCodeError("");
    try {
      const apiResponse = await api.post("/game/defuse/start");
      setDefuseSequence(apiResponse.data.sequence);
      setPhase("playing");
      new Audio("/sounds/defuse_start.mp3").play().catch(() => {});
    } catch (requestError) {
      setErrorMessage(requestError.response?.data?.error || "Failed to start defusing.");
      setPhase("idle");
    }
  }

  async function handleComplete() {
    setSubmitting(true);
    setPhase("success");
    try {
      await api.post("/game/defuse/complete", { errors: 0 });
      setTimeout(() => navigate("/lobby"), 3000);
    } catch (requestError) {
      setErrorMessage(requestError.response?.data?.error || "Failed to complete defuse.");
      setPhase("idle");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F6FA" }}>
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const currentMatch = matchData?.match;
  const allPlayers = matchData?.players || [];
  const myPlayerEntry = allPlayers.find((p) => p.id === currentUser?.id);
  const isCT = myPlayerEntry?.team === "ct";
  const isAlive = !!myPlayerEntry && myPlayerEntry.is_alive !== 0;

  if (!isCT || !isAlive || currentMatch?.status !== "planted") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F6FA" }}>
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F5F6FA" }}>
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
          Defuse bomb
        </div>
      </div>

      {bombExplodeAt && (phase === "idle" || phase === "code" || phase === "playing") && (
        <div
          className="py-3 text-center"
          style={{ backgroundColor: "#fff7ed", borderBottom: "1px solid #fed7aa" }}
        >
          <div className="text-xs text-orange-600 mb-1">Bomb timer</div>
          <BombTimer explodeAt={bombExplodeAt} />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 gap-6">

        {phase === "idle" && (
          <>
            <div className="text-center">
              <div
                className="text-xl font-bold"
                style={{ color: "#0B1F4A", fontFamily: "Montserrat, sans-serif" }}
              >
                Defuse the bomb
              </div>
              <div className="text-gray-500 text-sm mt-2">
                You'll need the 4-digit code from the bomb carrier's screen.
              </div>
            </div>

            {errorMessage && (
              <div
                className="w-full px-3 py-2 text-sm text-center"
                style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }}
              >
                {errorMessage}
              </div>
            )}

            <button
              onClick={handleStartDefusing}
              className="w-full py-6 font-bold text-xl"
              style={{ backgroundColor: "#F4762A", color: "#fff", border: "none", fontFamily: "Montserrat, sans-serif" }}
            >
              {errorMessage ? "Try again" : "Start defusing"}
            </button>
          </>
        )}

        {phase === "code" && (
          <>
            <div className="text-center">
              <div
                className="text-xl font-bold mb-1"
                style={{ color: "#0B1F4A", fontFamily: "Montserrat, sans-serif" }}
              >
                Enter bomb code
              </div>
              <div className="text-gray-500 text-sm">
                Ask the bomb carrier for the 4-digit code.
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              {codeDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={digitRefs[i]}
                  type="number"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(i, e)}
                  className="text-center font-mono font-bold text-3xl outline-none"
                  style={{
                    width: 64,
                    height: 72,
                    backgroundColor: "#fff",
                    border: codeError ? "2px solid #ef4444" : "2px solid #1A3468",
                    color: "#0B1F4A",
                    WebkitTextFillColor: "#0B1F4A",
                    fontSize: 32,
                  }}
                />
              ))}
            </div>

            {codeError && (
              <div
                className="w-full px-3 py-2 text-sm text-center"
                style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }}
              >
                {codeError}
              </div>
            )}

            <button
              onClick={handleCodeSubmit}
              className="w-full py-5 font-bold text-base"
              style={{ backgroundColor: "#F4762A", color: "#fff", border: "none", fontFamily: "Montserrat, sans-serif" }}
            >
              Confirm
            </button>

            <button
              onClick={() => setPhase("idle")}
              className="text-sm text-gray-500 underline"
            >
              Cancel
            </button>
          </>
        )}

        {phase === "playing" && defuseSequence && (
          <>
            <div className="text-center mb-2">
              <div
                className="text-lg font-bold"
                style={{ color: "#0B1F4A", fontFamily: "Montserrat, sans-serif" }}
              >
                Defusing...
              </div>
            </div>
            <SequenceGame
              sequence={defuseSequence}
              duration={defuseTimerSeconds}
              arrowTime={arrowTimeSeconds}
              maxErrors={maxDefuseErrors}
              onComplete={handleComplete}
              onFail={handleFail}
            />
          </>
        )}

        {phase === "success" && (
          <div className="text-center">
            <div
              className="text-2xl font-bold mb-3"
              style={{ color: "#16a34a", fontFamily: "Montserrat, sans-serif" }}
            >
              Bomb defused!
            </div>
            <div className="text-gray-500 text-sm">Counter-Terrorists win</div>
            <div className="text-gray-400 text-xs mt-4">Returning to lobby...</div>
          </div>
        )}

      </div>
    </div>
  );
}
