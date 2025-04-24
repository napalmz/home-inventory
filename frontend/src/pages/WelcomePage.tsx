import React, { useEffect, useState } from "react";
import { getApiWelcomeInfo } from "../api";

const WelcomePage: React.FC = () => {
  const [data, setData] = useState<{
    title: string;
    message: string;
    stats?: {
      total_inventories: number;
      total_items: number;
      total_users: number;
    };
  }>({ title: "", message: "" });

  useEffect(() => {
    getApiWelcomeInfo()
      .then((json) => setData({
        title: json.title,
        message: json.message,
        stats: json.stats
      }))
      .catch(() =>
        setData({ title: "Errore", message: "Impossibile contattare il server." })
      );
  }, []);

  return (
    <div className="p-8 max-w-3xl mx-auto text-center">
      <h1 className="text-4xl font-bold mb-4">{data.title || "Benvenuto in Home Inventory"}</h1>
      <p className="text-lg text-gray-700">{data.message}</p>
      {data.stats && (
        <div className="mt-6 text-sm text-gray-600 space-y-1">
          <p>Inventari totali: {data.stats.total_inventories}</p>
          <p>Item totali: {data.stats.total_items}</p>
          <p>Utenti registrati: {data.stats.total_users}</p>
        </div>
      )}
    </div>
  );
};

export default WelcomePage;