import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser, getSetting } from "../api";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);

  useEffect(() => {
    const checkRegistration = async () => {
      try {
        const setting = await getSetting("ENABLE_REGISTRATION");
        setRegistrationEnabled(String(setting.value).toLowerCase() === "true");
      } catch {
        setRegistrationEnabled(true); // fallback in caso di errore
      }
    };
    checkRegistration();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registerUser(username, password, email);
      navigate("/login");
    } catch {
      setError("Errore durante la registrazione");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-4 border rounded-xl shadow-xl">
      <h2 className="text-2xl font-bold mb-4">Registrazione</h2>
      {!registrationEnabled && (
        <p className="text-gray-500 mb-4">
          La registrazione è attualmente disabilitata.
        </p>
      )}
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border p-2 rounded"
            required
            disabled={!registrationEnabled}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border p-2 rounded"
            disabled={!registrationEnabled}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border p-2 rounded"
            required
            disabled={!registrationEnabled}
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          disabled={!registrationEnabled}
        >
          Registrati
        </button>
      </form>
    </div>
  );
}
