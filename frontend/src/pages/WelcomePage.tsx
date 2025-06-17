import { useEffect, useState } from "react";
import {
  getUserInfo,
  getApiWelcomeInfo,
  getRecentInventoriesAndChecklists,
  InventoryOrChecklistRecent,
  getSetting
} from "../api";

const WelcomePage = () => {
  const [welcomeInfo, setWelcomeInfo] = useState<null | {
    title: string;
    message: string;
    stats: {
      total_inventories: number;
      total_inventories_items: number;
      total_checklists: number;
      total_checklists_items: number;
      total_users: number;
    };
  }>(null);

  const [recenti, setRecenti] = useState<InventoryOrChecklistRecent[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    getApiWelcomeInfo().then(setWelcomeInfo);

    getUserInfo()
      .then(() => {
        setIsLoggedIn(true);
        getSetting("UI_RECENT_ITEMS_LIMIT").then((limitSetting) => {
          const limit = limitSetting?.value && !isNaN(Number(limitSetting.value)) ? Number(limitSetting.value) : 5;
          getRecentInventoriesAndChecklists(limit).then((data) => {
            console.log("Dati ricevuti da /recents:", data);
            setRecenti(data);
          });
        });
      })
      .catch(() => {
        setIsLoggedIn(false);
      });

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-center">{welcomeInfo?.title ?? "Benvenuto"}</h1>

      {welcomeInfo && (
        <div className="text-gray-700">
          <p className="mb-2 font-bold">{welcomeInfo.message}</p>
          {isLoggedIn && recenti.length > 0 && (
            <div className="bg-white shadow-md border border-gray-200 rounded p-4 mb-6">
              <h2 className="text-lg font-semibold mb-2">Ultimi inventari e liste usati:</h2>
              <table className="w-full table-auto text-left text-sm border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 border-b border-gray-300">#</th>
                    <th className="p-3 border-b border-gray-300">Nome</th>
                    <th className="p-3 border-b border-gray-300">Ultima modifica</th>
                  </tr>
                </thead>
                <tbody>
                  {recenti.map((rec, idx) => (
                    <tr
                      key={`${rec.type}-${rec.id}`}
                      className={`cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}
                      onClick={() => window.location.href = `/${rec.type === "INVENTORY" ? "inventories" : "checklists"}/${rec.id}`}
                    >
                      <td className="p-3">{idx + 1} {isMobile ? (rec.type === "INVENTORY" ? "📦" : "📝") : (rec.type === "INVENTORY" ? "INV" : "LIS")}</td>
                      <td className="p-3">{rec.name}</td>
                      <td className="p-3">{new Date(rec.data_mod).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mb-2 font-semibold">Statistiche</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-2 text-gray-800">
            <li>Totale inventari: {welcomeInfo.stats.total_inventories}</li>
            <li>Totale oggetti negli inventari: {welcomeInfo.stats.total_inventories_items}</li>
            <li>Totale checklist: {welcomeInfo.stats.total_checklists}</li>
            <li>Totale oggetti nelle checklist: {welcomeInfo.stats.total_checklists_items}</li>
            <li>Totale utenti: {welcomeInfo.stats.total_users}</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default WelcomePage;