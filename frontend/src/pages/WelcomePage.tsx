import React, { useEffect, useState } from "react";
import { getApiWelcomeInfo } from "../api";

const WelcomePage: React.FC = () => {
  const [data, setData] = useState<{
    title: string;
    message: string;
    stats?: {
      total_inventories: number;
      total_inventories_items: number;
      total_checklists: number;
      total_checklists_items: number;
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
      <p className="text-lg text-gray-700 dark:text-gray-400">{data.message}</p>
      {data.stats && (
        <div className="mt-6 text-sm text-gray-600 dark:text-gray-200 space-y-1">
          <p>Inventari totali: {data.stats.total_inventories}</p>
          <p>Item inventari totali: {data.stats.total_inventories_items}</p>
          <p>Liste totali: {data.stats.total_checklists}</p>
          <p>Item liste totali: {data.stats.total_checklists_items}</p>
          <p>Utenti registrati: {data.stats.total_users}</p>
        </div>
      )}
    </div>
  );
};

export default WelcomePage;