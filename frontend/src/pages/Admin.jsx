import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import socket from "../lib/socket";
import { getUser } from "../lib/auth";
import { MoveLeft } from "lucide-react";

const DEFAULT_CONFIG = {
  match_length_seconds: 120,
  bomb_timer_seconds: 40,
  plant_timer_seconds: 15,
  defuse_timer_seconds: 10,
  arrow_time_seconds: 2,
  plant_sequence_length: 6,
  defuse_sequence_length: 6,
  max_plant_errors: 3,
  max_defuse_errors: 3,
};

export default function Admin() {
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [configSaving, setConfigSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const navigate = useNavigate();
  const currentUser = getUser();

  if (currentUser?.is_admin !== 1) {
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
            style={{ backgroundColor: "#F4762A", color: "#fff", border: "none" }}
          >
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  async function fetchMatch() {
    try {
      const apiResponse = await api.get("/match");
      setMatchData(apiResponse.data);
      if (apiResponse.data?.match) {
        setConfig({
          match_length_seconds: apiResponse.data.match.match_length_seconds ?? 120,
          bomb_timer_seconds: apiResponse.data.match.bomb_timer_seconds ?? 40,
          plant_timer_seconds: apiResponse.data.match.plant_timer_seconds ?? 15,
          defuse_timer_seconds: apiResponse.data.match.defuse_timer_seconds ?? 10,
          arrow_time_seconds: apiResponse.data.match.arrow_time_seconds ?? 2,
          plant_sequence_length: apiResponse.data.match.plant_sequence_length ?? 6,
          defuse_sequence_length: apiResponse.data.match.defuse_sequence_length ?? 6,
          max_plant_errors: apiResponse.data.match.max_plant_errors ?? 3,
          max_defuse_errors: apiResponse.data.match.max_defuse_errors ?? 3,
        });
      }
    } catch (requestError) {
      if (requestError.response?.status !== 404) {
        console.error("Failed to load match data.");
      }
      setMatchData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMatch();
    socket.on("match:state", (matchStateData) => {
      setMatchData(matchStateData);
    });
    return () => socket.off("match:state");
  }, []);

  async function doAction(actionFunction) {
    try {
      await actionFunction();
    } catch (requestError) {
      console.error(requestError.response?.data?.error || "Error occurred.");
    }
  }

  async function createMatch() {
    await doAction(() => api.post("/match"));
  }

  async function startMatch() {
    await doAction(() => api.post("/match/start"));
    navigate("/lobby");
  }

  async function resetMatch() {
    if (!window.confirm("Reset and delete current match?")) return;
    await doAction(() => api.post("/match/reset"));
  }

  async function saveConfig() {
    setConfigSaving(true);
    try {
      await api.patch("/match/config", config);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (requestError) {
      console.error(requestError.response?.data?.error || "Failed to save config.");
    } finally {
      setConfigSaving(false);
    }
  }

  async function assignTeam(userId, newTeamValue) {
    await doAction(() =>
      api.post("/admin/assign-team", { user_id: userId, team: newTeamValue }),
    );
  }

  async function randomizeTeams() {
    await doAction(() => api.post("/admin/randomize-teams"));
  }

  const currentMatch = matchData?.match;
  const allPlayers = matchData?.players || [];
  const hasMatch = !!currentMatch;
  const matchStatus = currentMatch?.status;

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: "#F5F6FA" }}>
      {savedToast && (
        <div
          className="fixed top-4 right-4 z-50 px-5 py-3 text-sm font-semibold"
          style={{ backgroundColor: "#1A3468", color: "#fff", pointerEvents: "none" }}
        >
          Config saved
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3">
        <div
          className="text-lg font-bold"
          style={{ color: "#0B1F4A", fontFamily: "Montserrat, sans-serif" }}
        >
          Admin dashboard
        </div>
        <button
          onClick={() => navigate("/lobby")}
          className="px-3 py-2 text-sm font-semibold"
          style={{
            backgroundColor: "#F4762A",
            color: "#fff",
            border: "none",
          }}
        >
          <MoveLeft className="w-3 h-3 inline" /> Lobby
        </button>
      </div>

      <div className="py-4 flex flex-col gap-6">
        <Section title="Match control">
          <div className="flex flex-col gap-2">
            {!hasMatch && (
              <ActionButton
                onClick={createMatch}
                color="#F4762A"
                textColor="#fff"
              >
                Create match
              </ActionButton>
            )}
            {hasMatch && matchStatus === "lobby" && (
              <ActionButton
                onClick={startMatch}
                color="#F4762A"
                textColor="#fff"
              >
                Start match
              </ActionButton>
            )}
            {hasMatch && matchStatus !== "lobby" && (
              <ActionButton
                onClick={resetMatch}
                color="#C0392B"
                textColor="#fff"
              >
                Reset match
              </ActionButton>
            )}
            {hasMatch && (
              <div
                className="text-center text-sm py-2"
                style={{ color: "#000" }}
              >
                Status: {matchStatus}
              </div>
            )}
          </div>
        </Section>

        {hasMatch && matchStatus === "lobby" && (
          <Section title="Match configuration">
            <div className="flex flex-col gap-3">
              <ConfigRow
                label="Match length (sec)"
                value={config.match_length_seconds}
                onChange={(v) =>
                  setConfig((c) => ({ ...c, match_length_seconds: v }))
                }
              />
              <ConfigRow
                label="Bomb timer (sec)"
                value={config.bomb_timer_seconds}
                onChange={(v) =>
                  setConfig((c) => ({ ...c, bomb_timer_seconds: v }))
                }
              />
              <ConfigRow
                label="Plant sequence length"
                value={config.plant_sequence_length}
                onChange={(v) =>
                  setConfig((c) => ({ ...c, plant_sequence_length: v }))
                }
              />
              <ConfigRow
                label="Defuse sequence length"
                value={config.defuse_sequence_length}
                onChange={(v) =>
                  setConfig((c) => ({ ...c, defuse_sequence_length: v }))
                }
              />
              <ConfigRow
                label="Plant time (sec)"
                value={config.plant_timer_seconds}
                onChange={(v) =>
                  setConfig((c) => ({ ...c, plant_timer_seconds: v }))
                }
              />
              <ConfigRow
                label="Defuse time (sec)"
                value={config.defuse_timer_seconds}
                onChange={(v) =>
                  setConfig((c) => ({ ...c, defuse_timer_seconds: v }))
                }
              />
              <ConfigRow
                label="Arrow time (sec)"
                value={config.arrow_time_seconds}
                step={0.5}
                min={0.5}
                onChange={(v) =>
                  setConfig((c) => ({ ...c, arrow_time_seconds: v }))
                }
              />
              <ConfigRow
                label="Max plant errors"
                value={config.max_plant_errors}
                min={1}
                onChange={(v) =>
                  setConfig((c) => ({ ...c, max_plant_errors: v }))
                }
              />
              <ConfigRow
                label="Max defuse errors"
                value={config.max_defuse_errors}
                min={1}
                onChange={(v) =>
                  setConfig((c) => ({ ...c, max_defuse_errors: v }))
                }
              />
              <ActionButton
                onClick={saveConfig}
                color="#374151"
                textColor="#f1f1f1"
                disabled={configSaving}
              >
                {configSaving ? "Saving..." : "Save config"}
              </ActionButton>
            </div>
          </Section>
        )}

        {hasMatch && matchStatus === "lobby" && (
          <Section title={`Players (${allPlayers.length})`}>
            <div className="mb-3">
              <ActionButton
                onClick={randomizeTeams}
                color="#F4762A"
                textColor="#fff"
              >
                Randomize teams
              </ActionButton>
            </div>
            {allPlayers.length === 0 && (
              <div className="text-gray-500 text-sm py-2">
                No players in match yet.
              </div>
            )}
            {allPlayers.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                onAssignTeam={assignTeam}
              />
            ))}
          </Section>
        )}

        {!hasMatch && !loading && (
          <div className="text-center text-gray-500 text-sm py-4">
            No active match. Create one above.
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div
        className="px-8 py-2 text-sm font-bold w-full"
        style={{
          backgroundColor: "#1A3468",
          color: "#fff",
          fontFamily: "Montserrat, sans-serif",
        }}
      >
        {title}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function ActionButton({ onClick, color, textColor, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-50 mx-auto py-4 font-semibold text-sm cursor-pointer"
      style={{
        backgroundColor: disabled ? "#7B96C9" : color,
        color: disabled ? "#fff" : textColor,
        border: "none",
      }}
    >
      {children}
    </button>
  );
}

function ConfigRow({ label, value, onChange, step = 1, min = 1 }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="px-4 text-sm text-black flex-1">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={999}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="font-mono text-center outline-none w-20 px-2 py-2"
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #7B96C9",
          color: "#000000",
          fontSize: "16px",
          WebkitTextFillColor: "#000000",
        }}
      />
    </div>
  );
}

function PlayerRow({ player, onAssignTeam }) {
  return (
    <div className="py-3 px-4 flex flex-col gap-2">
      <span className="font-bold text-md" style={{ color: "#000" }}>
        {player.username}
      </span>
      <select
        value={player.team || ""}
        onChange={(e) => onAssignTeam(player.id, e.target.value)}
        className="text-sm px-2 py-2 outline-none"
        style={{
          backgroundColor: "#F4762A",
          color: "#fff",
        }}
      >
        <option value="">No team</option>
        <option value="ct">Counter-Terrorist</option>
        <option value="terrorist">Terrorist</option>
      </select>
    </div>
  );
}
