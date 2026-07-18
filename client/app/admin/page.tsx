"use client";
import { useState, useEffect } from "react";

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState("");

  //// Live Clock (Cyber Style)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour12: true }) + " | " + now.toLocaleDateString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  //// Fetch Users
  const fetchUsers = async () => {
    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/admin/users");
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  //// Handle Admin Actions (Approve, Lock, Unlock)
  const handleAction = async (email: string, action: string) => {
    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/admin/user/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action }),
      });
      if (res.ok) {
        fetchUsers(); // Refresh table after action
      }
    } catch (error) {
      console.error("Action failed");
    }
  };

  //// Manually Add User (Uses existing register endpoint)
  const handleAddUser = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, email: newEmail }),
      });
      const data = await res.json();
      setMessage(data.message || data.error);
      if (res.ok) {
        setNewUsername("");
        setNewEmail("");
        fetchUsers();
      }
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("Failed to add user");
    }
  };

  //// Download Full Audit Report (CSV)
  const downloadCSV = async () => {
    try {
      // Fetch File Logs & Message Logs from Backend
      const fileRes = await fetch("https://zero-trust-project-new.vercel.app/admin/logs/files");
      const files = await fileRes.json();

      const msgRes = await fetch("https://zero-trust-project-new.vercel.app/admin/logs/messages");
      const messages = await msgRes.json();

      // Build CSV Content Document
      let csvContent = "=== ZERO TRUST WORKSPACE - FULL SYSTEM AUDIT REPORT ===\n\n";

      // Section 1: Users
      csvContent += "--- USER ACCOUNTS ---\n";
      csvContent += "ID,Username,Email,Status,Locked,Last IP,Last Login Time\n";
      users.forEach(u => {
        csvContent += `${u.id},${u.username},${u.email},${u.status},${u.is_locked},${u.last_login_ip || "NULL"},${u.last_login_time || "NEVER"}\n`;
      });

      // Section 2: File Transfer Logs (Metadata Only)
      csvContent += "\n--- SECURE FILE TRANSFERS (METADATA) ---\n";
      csvContent += "Log ID,Sender Email,Receiver Email,File Name,Timestamp\n";
      if (files.length === 0) csvContent += "No file transfers found.\n";
      files.forEach((f: any) => {
        csvContent += `${f.id},${f.sender_email},${f.receiver_email},${f.file_name},${new Date(f.timestamp).toLocaleString()}\n`;
      });

      // Section 3: Chat Activity Logs (Metadata Only)
      csvContent += "\n--- CHAT ACTIVITY LOGS (METADATA) ---\n";
      csvContent += "Log ID,Sender Email,Receiver Email (Blank=Global Chat),Timestamp\n";
      if (messages.length === 0) csvContent += "No chat messages found.\n";
      messages.forEach((m: any) => {
        csvContent += `${m.id},${m.sender_email},${m.receiver_email || "GLOBAL CHAT"},${new Date(m.timestamp).toLocaleString()}\n`;
      });

      // Create and Download the File
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ZeroTrust_Full_Audit_Report.csv";
      a.click();
      
    } catch (error) {
      console.error("Failed to generate Full CSV Report", error);
      alert("Failed to download the audit report. Check server connection.");
    }
  };

  //// Cyber Security UI Theme (Black bg, Cyan/Neon accents, Monospace font)
  return (
    <div className="min-h-screen bg-black text-cyan-400 font-mono p-8 selection:bg-cyan-900">
      
      {/* Header Section */}
      <div className="flex justify-between items-center border-b border-cyan-800 pb-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-widest drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
            SYSTEM_ADMIN_PANEL
          </h1>
          <p className="text-sm text-cyan-700 mt-1">Zero Trust Security Workspace</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-green-400 tracking-widest">{currentTime}</p>
          <p className="text-xs text-cyan-800 mt-1">SECURE CONNECTION ESTABLISHED</p>
        </div>
      </div>

      {/* Control Panel Section */}
      <div className="bg-gray-950 border border-cyan-900 p-6 rounded mb-8 shadow-[0_0_15px_rgba(8,145,178,0.2)]">
        <div className="flex justify-between items-center">
          <form onSubmit={handleAddUser} className="flex gap-4 items-center">
            <span className="text-sm">ADD_NODE:</span>
            <input
              type="text"
              placeholder="Username"
              value={newUsername}
              required
              className="bg-black border border-cyan-800 p-2 text-sm focus:outline-none focus:border-cyan-400"
              onChange={(e) => setNewUsername(e.target.value)}
            />
            <input
              type="email"
              placeholder="Email Address"
              value={newEmail}
              required
              className="bg-black border border-cyan-800 p-2 text-sm focus:outline-none focus:border-cyan-400"
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <button type="submit" className="bg-cyan-900 hover:bg-cyan-700 text-white px-6 py-2 text-sm border border-cyan-600 transition-colors">
              EXECUTE_ADD
            </button>
            {message && <span className="text-yellow-400 text-sm ml-4">{message}</span>}
          </form>

          <button onClick={downloadCSV} className="bg-black hover:bg-cyan-950 border border-cyan-700 px-4 py-2 text-sm transition-colors flex items-center gap-2">
            <span>[ DOWNLOAD_LOGS.CSV ]</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto border border-cyan-900 shadow-[0_0_15px_rgba(8,145,178,0.1)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-cyan-950 text-cyan-300 border-b border-cyan-800">
            <tr>
              <th className="p-4 font-normal tracking-widest">ID</th>
              <th className="p-4 font-normal tracking-widest">USER INFO</th>
              <th className="p-4 font-normal tracking-widest">NETWORK INFO (LAST LOGIN)</th>
              <th className="p-4 font-normal tracking-widest">STATUS</th>
              <th className="p-4 font-normal tracking-widest">ADMIN CONTROLS</th>
            </tr>
          </thead>
          <tbody className="bg-black divide-y divide-cyan-900">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-cyan-700">NO ACTIVE NODES FOUND...</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-900 transition-colors">
                  <td className="p-4 text-cyan-600">#{user.id}</td>
                  <td className="p-4">
                    <p className="font-bold text-gray-200">{user.username}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </td>
                  <td className="p-4 text-xs text-gray-400">
                    <p>IP: <span className="text-cyan-500">{user.last_login_ip || "NULL"}</span></p>
                    <p>TIME: {user.last_login_time ? new Date(user.last_login_time).toLocaleString() : "NEVER"}</p>
                  </td>
                  <td className="p-4">
                    {user.is_locked ? (
                      <span className="bg-red-900/50 text-red-400 border border-red-700 px-2 py-1 text-xs">LOCKED</span>
                    ) : user.status === 'pending' ? (
                      <span className="bg-yellow-900/50 text-yellow-400 border border-yellow-700 px-2 py-1 text-xs">PENDING</span>
                    ) : (
                      <span className="bg-green-900/50 text-green-400 border border-green-700 px-2 py-1 text-xs">ACTIVE</span>
                    )}
                  </td>
                  <td className="p-4 flex gap-2">
                    {/* Approve Button */}
                    {user.status === 'pending' && (
                      <button onClick={() => handleAction(user.email, 'approve')} className="bg-black border border-green-600 text-green-500 hover:bg-green-950 px-3 py-1 text-xs transition-colors">
                        APPROVE
                      </button>
                    )}
                    
                    {/* Lock / Unlock Buttons */}
                    {user.is_locked ? (
                      <button onClick={() => handleAction(user.email, 'unlock')} className="bg-black border border-blue-500 text-blue-400 hover:bg-blue-950 px-3 py-1 text-xs transition-colors drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]">
                        UNLOCK ACCOUNT
                      </button>
                    ) : (
                      <button onClick={() => handleAction(user.email, 'lock')} className="bg-black border border-red-600 text-red-500 hover:bg-red-950 px-3 py-1 text-xs transition-colors">
                        FORCE LOCK
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
    </div>
  );
}