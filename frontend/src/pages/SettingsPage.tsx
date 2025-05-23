import { useState } from "react";
import GeneralSettings from "./settings/GeneralSettings";
import UserManagementPage from "./settings/UserManagementPage";
//import RoleManagementPage from "./settings/RoleManagementPage";
import GroupManagementPage from "./settings/GroupManagementPage";
//import InfoPage from "./settings/InfoPage";
import BackupManagementPage from "./settings/BackupManagementPage";

const tabs = [
  { name: "Generale", component: <GeneralSettings /> },
  { name: "Utenti", component: <UserManagementPage /> },
  //{ name: "Ruoli", component: <RoleManagementPage /> },
  { name: "Gruppi", component: <GroupManagementPage /> },
  { name: "Backup", component: <BackupManagementPage /> },
  //{ name: "Info", component: <InfoPage /> },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("Generale");

  const currentTab = tabs.find((tab) => tab.name === activeTab);

  return (
    <div className="p-4 overflow-x-hidden w-full max-w-full">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 flex flex-wrap gap-2 border-b mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            className={`px-4 py-2 ${
              tab.name === activeTab ? "border-b-2 border-blue-500 font-semibold" : ""
            }`}
            onClick={() => setActiveTab(tab.name)}
          >
            {tab.name}
          </button>
        ))}
      </div>
      <div>{currentTab?.component}</div>
    </div>
  );
}