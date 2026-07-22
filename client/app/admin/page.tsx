"use client";
import { useState, useEffect, useRef } from "react";

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState("");

  // AI Copilot States
  const [chatMessages, setChatMessages] = useState<{sender: string, text: string}[]>([
    { sender: 'AI', text: 'SECURITY COPILOT INITIALIZED. AWAITING COMMANDS...' }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isTyping]);

  //// Handle Admin Actions (Approve, Lock, Unlock)
  const handleAction = async (email: string, action: string) => {
    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/admin/user/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error("Action failed");
    }
  };

  //// Manually Add User
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
      const fileRes = await fetch("https://zero-trust-project-new.vercel.app/admin/logs/files");
      const files = await fileRes.json();

      const msgRes = await fetch("https://zero-trust-project-new.vercel.app/admin/logs/messages");
      const messages = await msgRes.json();

      let csvContent = "=== ZERO TRUST WORKSPACE - FULL SYSTEM AUDIT REPORT ===\n\n";

      csvContent += "--- USER ACCOUNTS ---\n";
      csvContent += "ID,Username,Email,Status,Locked,Last IP,Last Login Time\n";
      users.forEach(u => {
        csvContent += `${u.id},${u.username},${u.email},${u.status},${u.is_locked},${u.last_login_ip || "NULL"},${u.last_login_time || "NEVER"}\n`;
      });

      csvContent += "\n--- SECURE FILE TRANSFERS (METADATA) ---\n";
      csvContent += "Log ID,Sender Email,Receiver Email,File Name,Timestamp\n";
      if (files.length === 0) csvContent += "No file transfers found.\n";
      files.forEach((f: any) => {
        csvContent += `${f.id},${f.sender_email},${f.receiver_email},${f.file_name},${new Date(f.timestamp).toLocaleString()}\n`;
      });

      csvContent += "\n--- CHAT ACTIVITY LOGS (METADATA) ---\n";
      csvContent += "Log ID,Sender Email,Receiver Email (Blank=Global Chat),Timestamp\n";
      if (messages.length === 0) csvContent += "No chat messages found.\n";
      messages.forEach((m: any) => {
        csvContent += `${m.id},${m.sender_email},${m.receiver_email || "GLOBAL CHAT"},${new Date(m.timestamp).toLocaleString()}\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ZeroTrust_Full_Audit_Report.csv";
      a.click();
      
    } catch (error) {
      alert("Failed to download the audit report.");
    }
  };

  //// Handle Copilot Chat Submission
  const handleChatSubmit = async (e: any) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg = { sender: 'ADMIN', text: chatInput };
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput("");
    setIsTyping(true);

    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/admin/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMsg.text }),
      });
      const data = await res.json();
      
      setChatMessages(prev => [...prev, { sender: 'AI', text: data.response || "NO RESPONSE DETECTED." }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { sender: 'AI', text: "ERROR: CONNECTION TO AI CORE FAILED." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-cyan-400 font-mono p-4 md:p-8 selection:bg-cyan-900 flex flex-col h-screen overflow-hidden">
      
      {/* Header Section */}
      <div className="flex justify-between items-center border-b border-cyan-800 pb-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-widest drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
            SYSTEM_ADMIN_PANEL
          </h1>
          <p className="text-xs md:text-sm text-cyan-700 mt-1">Zero Trust Security Workspace</p>
        </div>
        <div className="text-right">
          <p className="text-lg md:text-xl font-bold text-green-400 tracking-widest">{currentTime}</p>
          <p className="text-[10px] md:text-xs text-cyan-800 mt-1">SECURE CONNECTION ESTABLISHED</p>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
        
        {/* Left Side: Users & Controls */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Control Panel Section */}
          <div className="bg-gray-950 border border-cyan-900 p-4 md:p-6 rounded mb-6 shadow-[0_0_15px_rgba(8,145,178,0.2)] shrink-0">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
              <form onSubmit={handleAddUser} className="flex flex-wrap gap-2 md:gap-4 items-center w-full xl:w-auto">
                <span className="text-xs md:text-sm whitespace-nowrap">ADD_NODE:</span>
                <input
                  type="text"
                  placeholder="Username"
                  value={newUsername}
                  required
                  className="bg-black border border-cyan-800 p-2 text-xs md:text-sm focus:outline-none focus:border-cyan-400 flex-1 min-w-[120px]"
                  onChange={(e) => setNewUsername(e.target.value)}
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={newEmail}
                  required
                  className="bg-black border border-cyan-800 p-2 text-xs md:text-sm focus:outline-none focus:border-cyan-400 flex-1 min-w-[150px]"
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                <button type="submit" className="bg-cyan-900 hover:bg-cyan-700 text-white px-4 py-2 text-xs md:text-sm border border-cyan-600 transition-colors whitespace-nowrap">
                  EXECUTE
                </button>
                {message && <span className="text-yellow-400 text-xs md:text-sm w-full xl:w-auto mt-2 xl:mt-0">{message}</span>}
              </form>

              <button onClick={downloadCSV} className="bg-black hover:bg-cyan-950 border border-cyan-700 px-4 py-2 text-xs md:text-sm transition-colors flex items-center gap-2 whitespace-nowrap">
                <span>[ DOWNLOAD_LOGS.CSV ]</span>
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-y-auto border border-cyan-900 shadow-[0_0_15px_rgba(8,145,178,0.1)] flex-1 relative custom-scrollbar">
            <table className="w-full text-left text-xs md:text-sm absolute top-0 left-0 right-0">
              <thead className="bg-cyan-950 text-cyan-300 border-b border-cyan-800 sticky top-0 z-10">
                <tr>
                  <th className="p-3 md:p-4 font-normal tracking-widest">ID</th>
                  <th className="p-3 md:p-4 font-normal tracking-widest">USER INFO</th>
                  <th className="p-3 md:p-4 font-normal tracking-widest hidden sm:table-cell">NETWORK INFO</th>
                  <th className="p-3 md:p-4 font-normal tracking-widest">STATUS</th>
                  <th className="p-3 md:p-4 font-normal tracking-widest text-right">CONTROLS</th>
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
                      <td className="p-3 md:p-4 text-cyan-600">#{user.id}</td>
                      <td className="p-3 md:p-4">
                        <p className="font-bold text-gray-200">{user.username}</p>
                        <p className="text-[10px] md:text-xs text-gray-500 break-all">{user.email}</p>
                      </td>
                      <td className="p-3 md:p-4 text-[10px] md:text-xs text-gray-400 hidden sm:table-cell">
                        <p>IP: <span className="text-cyan-500">{user.last_login_ip || "NULL"}</span></p>
                        <p className="truncate max-w-[150px]" title={user.last_login_time ? new Date(user.last_login_time).toLocaleString() : "NEVER"}>
                           {user.last_login_time ? new Date(user.last_login_time).toLocaleDateString() : "NEVER"}
                        </p>
                      </td>
                      <td className="p-3 md:p-4">
                        {user.is_locked ? (
                          <span className="bg-red-900/50 text-red-400 border border-red-700 px-2 py-1 text-[10px] md:text-xs">LOCKED</span>
                        ) : user.status === 'pending' ? (
                          <span className="bg-yellow-900/50 text-yellow-400 border border-yellow-700 px-2 py-1 text-[10px] md:text-xs">PENDING</span>
                        ) : (
                          <span className="bg-green-900/50 text-green-400 border border-green-700 px-2 py-1 text-[10px] md:text-xs">ACTIVE</span>
                        )}
                      </td>
                      <td className="p-3 md:p-4 flex flex-col md:flex-row gap-2 justify-end">
                        {user.status === 'pending' && (
                          <button onClick={() => handleAction(user.email, 'approve')} className="bg-black border border-green-600 text-green-500 hover:bg-green-950 px-2 md:px-3 py-1 text-[10px] md:text-xs transition-colors w-full md:w-auto">
                            APPROVE
                          </button>
                        )}
                        {user.is_locked ? (
                          <button onClick={() => handleAction(user.email, 'unlock')} className="bg-black border border-blue-500 text-blue-400 hover:bg-blue-950 px-2 md:px-3 py-1 text-[10px] md:text-xs transition-colors drop-shadow-[0_0_5px_rgba(59,130,246,0.5)] w-full md:w-auto">
                            UNLOCK
                          </button>
                        ) : (
                          <button onClick={() => handleAction(user.email, 'lock')} className="bg-black border border-red-600 text-red-500 hover:bg-red-950 px-2 md:px-3 py-1 text-[10px] md:text-xs transition-colors w-full md:w-auto">
                            LOCK
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

        {/* Right Side: Security Copilot Chat */}
        <div className="w-full lg:w-[350px] xl:w-[400px] border border-cyan-900 bg-gray-950 flex flex-col shrink-0 h-[400px] lg:h-auto shadow-[0_0_20px_rgba(8,145,178,0.15)]">
          <div className="bg-cyan-950 border-b border-cyan-800 p-3 flex items-center justify-between">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <h3 className="font-bold text-sm tracking-widest text-cyan-200">SECURITY_COPILOT</h3>
             </div>
             <span className="text-[10px] text-cyan-600">[AI MODULE]</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar bg-black/50">
             {chatMessages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.sender === 'ADMIN' ? 'items-end' : 'items-start'}`}>
                   <span className={`text-[10px] mb-1 ${msg.sender === 'ADMIN' ? 'text-gray-500' : 'text-cyan-600'}`}>{msg.sender}</span>
                   <div className={`p-3 text-xs md:text-sm border max-w-[85%] whitespace-pre-wrap ${
                      msg.sender === 'ADMIN' 
                      ? 'bg-gray-900 border-gray-700 text-gray-300' 
                      : 'bg-cyan-950/30 border-cyan-800 text-cyan-300 shadow-[0_0_10px_rgba(8,145,178,0.1)]'
                   }`}>
                      {msg.text}
                   </div>
                </div>
             ))}
             {isTyping && (
                <div className="flex flex-col items-start">
                   <span className="text-[10px] mb-1 text-cyan-600">AI</span>
                   <div className="p-3 text-xs border bg-cyan-950/30 border-cyan-800 text-cyan-500 animate-pulse">
                      Processing query...
                   </div>
                </div>
             )}
             <div ref={chatEndRef} />
          </div>

          <div className="border-t border-cyan-900 p-3 bg-gray-950">
             <form onSubmit={handleChatSubmit} className="flex gap-2">
                <span className="text-green-500 font-bold self-center"> &gt; </span>
                <input 
                   type="text" 
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   placeholder="Enter command..."
                   className="flex-1 bg-black border border-cyan-800 p-2 text-xs md:text-sm focus:outline-none focus:border-cyan-400 text-cyan-300 placeholder-cyan-900"
                />
             </form>
          </div>
        </div>

      </div>

      {/* Global CSS for Custom Scrollbar matching the theme */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #000;
          border-left: 1px solid #164e63;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #0891b2;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #06b6d4;
        }
      `}} />
    </div>
  );
}