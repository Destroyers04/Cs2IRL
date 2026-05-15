import { Heart, HeartOff } from "lucide-react";

export default function PlayerCard({ player, currentMatch }) {
  const isAlive = player.is_alive !== 0;
  const playerTeam = player.team;

  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b border-gray-200"
      style={{ opacity: isAlive ? 1 : 0.45 }}
    >
      <div className="flex items-center gap-3">
        <div
          className="text-xs font-bold px-2 py-1 w-10 text-center"
          style={{
            backgroundColor: playerTeam === "ct" ? "#4b69ff" : "#de9b35",
            color: "#fff",
          }}
        >
          {playerTeam === "ct" ? "CT" : playerTeam === "terrorist" ? "T" : "—"}
        </div>
        <span
          className="font-semibold text-base"
          style={{
            color: isAlive ? "#0B1F4A" : "#6B7A99",
            textDecoration: isAlive ? "none" : "line-through",
          }}
        >
          {player.username}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span style={{ color: isAlive ? "#FF0033" : "#6b7280" }}>
          {isAlive ? (
            <Heart fill="currentColor" className="w-5 h-5" />
          ) : (
            <HeartOff fill="currentColor" className="w-5 h-5" />
          )}
        </span>
      </div>
    </div>
  );
}
