import { useEffect, useState } from "react";
import { getUserInfo, updateMe } from "../api";

const ProfilePage = () => {
  const [email, setEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [editEmail, setEditEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [showMessage, setShowMessage] = useState(false);
  const [showPasswordMessage, setShowPasswordMessage] = useState(false);
  const [messageCountdown, setMessageCountdown] = useState(5);
  const [passwordCountdown, setPasswordCountdown] = useState(5);
  const [isPasswordError, setIsPasswordError] = useState(false);

  useEffect(() => {
    getUserInfo()
      .then((user) => {
        if (typeof user === "object" && user !== null) {
          if ("email" in user) setEmail((user as { email: string }).email || "");
          if ("email_masked" in user) setMaskedEmail((user as { email_masked: string }).email_masked || "");
        }
      })
      .catch(() => {
        setMessage("Errore nel recupero delle informazioni utente.");
      });
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMe(email, '');
      setMessage("Dati anagrafici aggiornati con successo.");
      setShowMessage(true);
      setMessageCountdown(5);
      const countdownInterval = setInterval(() => {
        setMessageCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setShowMessage(false);
            return 5;
          }
          return prev - 1;
        });
      }, 1000);
      const updatedUser = await getUserInfo();
      if (typeof updatedUser === "object" && updatedUser !== null && "email" in updatedUser) {
        setEmail((updatedUser as { email: string }).email || "");
        if ("email_masked" in updatedUser) {
          setMaskedEmail((updatedUser as { email_masked: string }).email_masked || "");
        }
      }
      setEditEmail(false);
    } catch {
      setMessage("Errore nell'aggiornamento dei dati anagrafici.");
      setShowMessage(true);
      setMessageCountdown(5);
      const countdownInterval = setInterval(() => {
        setMessageCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setShowMessage(false);
            return 5;
          }
          return prev - 1;
        });
      }, 1000);
      setEditEmail(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      setPasswordMessage("Le password non possono essere vuote.");
      setIsPasswordError(true);
      setShowPasswordMessage(true);
      setPasswordCountdown(10);
      const countdownInterval = setInterval(() => {
        setPasswordCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setShowPasswordMessage(false);
            return 10;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordMessage("Le password non coincidono.");
      setIsPasswordError(true);
      setShowPasswordMessage(true);
      setPasswordCountdown(10);
      const countdownInterval = setInterval(() => {
        setPasswordCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setShowPasswordMessage(false);
            return 10;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }

    try {
      await updateMe("", password);
      setPasswordMessage("Password aggiornata con successo.");
      setIsPasswordError(false);
      setPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordMessage("Errore nell'aggiornamento della password.");
      setIsPasswordError(true);
    }

    setShowPasswordMessage(true);
    setPasswordCountdown(5);
    const countdownInterval = setInterval(() => {
      setPasswordCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setShowPasswordMessage(false);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-4 bg-white dark:bg-gray-900 shadow-md rounded space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-4">Dati Anagrafici</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            {!editEmail ? (
              <p
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded cursor-pointer text-gray-600 bg-gray-100"
                onClick={() => setEditEmail(true)}
              >
                {maskedEmail || "—"}
              </p>
            ) : (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded"
              />
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Salva Dati
          </button>
        </form>
        {message && showMessage && (
          <p
            className="mt-4 text-sm text-center transition-opacity duration-1000 text-green-600"
            style={{ opacity: messageCountdown / 5 }}
          >
            {message} (chiude tra {messageCountdown}s)
          </p>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Cambia Password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nuova Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded"
              autoComplete="new-password"
              autoCapitalize="off"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Ripeti Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded"
              autoComplete="new-password"
              autoCapitalize="off"
            />
          </div>
          {(password || confirmPassword) && (
            <div>
              {password === confirmPassword ? (
                <span className="text-green-600">✔️ Le password coincidono</span>
              ) : (
                <span className="text-red-600">❌ Le password non coincidono</span>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={!!((password || confirmPassword) && password !== confirmPassword) || (password == '' && confirmPassword == '')}
            className={`w-full  text-white py-2 px-4 rounded  ${
              ((password || confirmPassword) && password !== confirmPassword) ||
              (password == '' && confirmPassword == '')
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Salva Password
          </button>
        </form>
        {passwordMessage && showPasswordMessage && (
          <p
            className={`mt-4 text-sm text-center transition-opacity duration-1000 ${
              isPasswordError ? "text-red-600" : "text-green-600"
            }`}
            style={{ opacity: passwordCountdown / (isPasswordError ? 10 : 5) }}
          >
            {passwordMessage} (chiude tra {passwordCountdown}s)
          </p>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
