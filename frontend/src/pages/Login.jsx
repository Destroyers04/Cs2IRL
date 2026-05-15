import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { setToken } from "../lib/auth";
import { connectSocket } from "../lib/socket";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(formEvent) {
    formEvent.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoginError("");
    setLoading(true);
    try {
      const apiResponse = await api.post("/auth/login", {
        username: username.trim(),
        password,
      });
      setToken(apiResponse.data.token);
      connectSocket(apiResponse.data.token);
      navigate("/lobby");
    } catch (requestError) {
      setLoginError(
        requestError.response?.data?.error ||
          "Login failed. Check credentials.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "#F5F6FA" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-4">
          <div className="mb-4 flex items-center justify-center gap-3">
            <img
              className="w-15 rounded-sm"
              src="\public\Cs2-icon.jpg"
              alt="Cs2 Icon"
            />
          </div>
          <h1
            className="text-5xl font-bold uppercase"
            style={{ color: "#0B1F4A", fontFamily: "Montserrat, sans-serif" }}
          >
            CS2 IRL
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="username"
              className="text-sm font-semibold"
              style={{ color: "#000000" }}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(formEvent) => setUsername(formEvent.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              className="w-full px-4 py-4 rounded-lg text-base outline-none"
              style={{
                backgroundColor: "#FFFFFF",
                border: "2px solid #FFB347",
                color: "#000000",
                fontSize: "16px",
              }}
              placeholder="enter username"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="text-sm font-semibold"
              style={{ color: "#000000" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(formEvent) => setPassword(formEvent.target.value)}
              autoComplete="current-password"
              className="w-full px-4 py-4 rounded-lg text-base outline-none"
              style={{
                backgroundColor: "#FFFFFF",
                border: "2px solid #FFB347",
                color: "#000000",
                fontSize: "16px",
              }}
              placeholder="enter password"
            />
          </div>

          {loginError && (
            <div
              className="text-sm px-3 py-2"
              style={{
                backgroundColor: "#450a0a",
                color: "#f87171",
                border: "1px solid #7f1d1d",
              }}
            >
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-40 mx-auto py-4 font-semibold text-sm rounded-lg mt-2 cursor-pointer"
            style={{
              backgroundColor: loading ? "#FFB347" : "#F4762A",
              color: "#ffffff",
              transition: "background-color 0.2s",
            }}
          >
            {loading ? "Authenticating..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
