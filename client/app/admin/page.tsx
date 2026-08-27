admin 




"use client";
import React, { useState, useEffect } from 'react';

// ==========================================
// SECTION 1: TYPESCRIPT INTERFACES
// ==========================================
interface User {
  id: number;
  username: string;
  email: string;
  last_login_ip: string | null;
  last_login_time: string | null;
  session_active: boolean;
  is_locked: boolean;
  status: string; 
}

interface ChatMessage {
  sender: 'ADMIN' | 'AI';
  text: string;
}

interface SecurityLog {
  id: number;
  timestamp: string;
  content: string;
}

export default function AdminDashboard() {
  // ==========================================
  // SECTION 2: STATE MANAGEMENT
  // ==========================================
  const [users, setUsers] = useState<User[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [command, setCommand] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { sender: 'AI', text: 'SECURITY COPILOT INITIALIZED. AWAITING COMMANDS...' }
  ]);
  const [isLockdown, setIsLockdown] = useState<boolean>(false);
  
  // State for manual user provisioning
  const [addUsername, setAddUsername] = useState("");
  const [addEmail, setAddEmail] = useState("");

  const API_URL = "https://zero-trust-project-new.vercel.app";

  // ==========================================
  // SECTION 3: DATA FETCHING
  // ==========================================
  const fetchData = async () => {
    try {
      const resUsers = await fetch(`${API_URL}/admin/users`);
      if (resUsers.ok) setUsers(await resUsers.json());

      const resLogs = await fetch(`${API_URL}/admin/logs/messages`);
      if (resLogs.ok) {
        const dataLogs = await resLogs.json();
        setSecurityLogs(dataLogs.filter((log: any) => log.sender_email === 'ai_admin'));
      }
    } catch (err) { 
      console.error("Error fetching data:", err); 
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh data every 5 seconds
    const interval = setInterval(fetchData, 5000); 
    return () => clearInterval(interval);
  }, []);

  // ==========================================
  // SECTION 4: USER CONTROL HANDLERS
  // ==========================================
  const handleApproveUser = async (email: string) => {
    await fetch(`${API_URL}/admin/user/action`, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ email, action: 'approve' }) 
    });
    fetchData();
  };

  const handleKickUser = async (email: string) => {
    await fetch(`${API_URL}/admin/user/action`, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ email, action: 'kick' }) 
    });
    alert(`User ${email} kicked successfully!`); 
    fetchData();
  };

  const handleLockUser = async (email: string, currentStatus: boolean) => {
    await fetch(`${API_URL}/admin/user/action`, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ email, action: currentStatus ? 'unlock' : 'lock' }) 
    });
    fetchData();
  };

  // Handler for manual node provisioning
  const handleManualAdd = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: addUsername, email: addEmail }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("User provisioned successfully. Current state: [PENDING].");
        setAddUsername("");
        setAddEmail("");
        fetchData();
      } else {
        alert(data.error || "Failed to provision user.");
      }
    } catch (error) {
      alert("Cannot connect to the server.");
    }
  };

  // ==========================================
  // SECTION 5: SYSTEM-WIDE CONTROLS
  // ==========================================
  const handleLockdown = async () => {
    if (!window.confirm(`WARNING: Are you sure you want to ${isLockdown ? "LIFT" : "INITIATE"} SYSTEM LOCKDOWN?`)) return;
    const newState = !isLockdown; 
    const res = await fetch(`${API_URL}/admin/system/lockdown`, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ state: newState }) 
    });
    alert((await res.json()).message);
    setIsLockdown(newState); 
    fetchData();
  };

  const handleSimulateAttack = async () => {
    if (!window.confirm("Simulate DDoS Attack?")) return;
    alert("Attack started. Sending requests...");
    for (let i = 0; i < 20; i++) {
      fetch(`${API_URL}/login`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ email: `fake_hacker_${i}@gmail.com`, username: "hacker", location: "Unknown" }) 
      }).catch(() => {});
    }
    setTimeout(() => { 
      alert("Attack blocked by rate limiter. Verify Security Alerts."); 
      fetchData(); 
    }, 3000);
  };

  // ==========================================
  // SECTION 6: EXPORT & LOGGING FUNCTIONS
  // ==========================================
  const downloadCSV = () => {
    const headers = "ID,Username,Email,IP,Status,Last Login\n";
    const csvData = users.map(u => `${u.id},${u.username},${u.email},${u.last_login_ip || 'NULL'},${u.status},${u.last_login_time || 'NEVER'}`).join("\n");
    const blob = new Blob([headers + csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Zero_Trust_Users.csv';
    a.click();
  };

  const downloadAuditReport = () => {
    const header = "========================================\n       ZERO TRUST SECURITY AUDIT LOG       \n========================================\nGenerated: " + new Date().toLocaleString() + "\n\n";
    const logs = securityLogs.map(log => `[${new Date(log.timestamp).toLocaleString()}]\n${log.content}\n----------------------------------------`).join("\n\n");
    const blob = new Blob([header + logs], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Security_Audit_Report.txt';
    a.click();
  };

  // ==========================================
  // SECTION 7: AI COPILOT LOGIC
  // ==========================================
  const handleChatSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && command.trim() !== '') {
      const newChat: ChatMessage[] = [...chatHistory, { sender: 'ADMIN', text: command }];
      setChatHistory(newChat); 
      setCommand('');
      try {
        const res = await fetch(`${API_URL}/admin/copilot/chat`, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ message: command }) 
        });
        setChatHistory([...newChat, { sender: 'AI', text: (await res.json()).response }]);
      } catch { 
        setChatHistory([...newChat, { sender: 'AI', text: 'ERROR: CONNECTION FAILED.' }]); 
      }
    }
  };

  // ==========================================
  // SECTION 8: USER INTERFACE (RENDER)
  // ==========================================
  return (
    <div style={{ backgroundColor: '#000', color: '#0ff', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #0ff', paddingBottom: '10px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', margin: 0, textShadow: '0 0 5px #0ff' }}>SYSTEM_ADMIN_PANEL</h1>
          <p style={{ margin: 0, color: '#088' }}>Zero Trust Security Workspace</p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <p style={{ margin: 0, fontSize: '18px', color: '#0f0' }}>{new Date().toLocaleString()}</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={handleSimulateAttack} style={{ padding: '8px 15px', backgroundColor: '#500', color: '#fff', border: '1px solid #f00', cursor: 'pointer', fontWeight: 'bold' }}>
              [!] SIMULATE DDoS
            </button>
            <button onClick={handleLockdown} style={{ padding: '8px 15px', backgroundColor: isLockdown ? '#006400' : '#800000', color: '#fff', border: `1px solid ${isLockdown ? '#0f0' : 'red'}`, cursor: 'pointer', fontWeight: 'bold' }}>
              {isLockdown ? '[ LIFT LOCKDOWN ]' : '[ INITIATE LOCKDOWN ]'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Main Content Area */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Active Nodes Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ color: '#0ff', margin: 0 }}>// ACTIVE NODES (USERS)</h3>
              <button onClick={downloadCSV} style={{ background: '#022', color: '#0ff', border: '1px solid #0ff', padding: '5px 10px', cursor: 'pointer' }}>
                [ Export Users (CSV) ]
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #088' }}>
              <thead style={{ backgroundColor: '#022' }}>
                <tr>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #088' }}>ID</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #088' }}>USER INFO</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #088' }}>NETWORK INFO</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #088' }}>STATUS</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #088' }}>CONTROLS</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #044' }}>
                    <td style={{ padding: '10px', color: '#088' }}>#{i + 1}</td>
                    <td style={{ padding: '10px' }}><b>{u.username}</b><br/><span style={{ fontSize: '12px', color: '#888' }}>{u.email}</span></td>
                    <td style={{ padding: '10px', fontSize: '12px' }}>IP: <span style={{ color: '#0ff' }}>{u.last_login_ip || 'NULL'}</span><br/>{u.last_login_time ? new Date(u.last_login_time).toLocaleDateString() : 'NEVER'}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ color: u.status === 'approved' ? '#0f0' : 'yellow', fontSize: '12px', marginBottom: '5px' }}>[{u.status ? u.status.toUpperCase() : 'UNKNOWN'}]</div>
                      <span style={{ color: u.session_active ? '#0f0' : '#888', border: `1px solid ${u.session_active ? '#0f0' : '#888'}`, padding: '2px 5px', fontSize: '10px' }}>{u.session_active ? 'ACTIVE' : 'OFFLINE'}</span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {u.status !== 'approved' && <button onClick={() => handleApproveUser(u.email)} style={{ background: 'transparent', color: '#0ff', border: '1px solid #0ff', padding: '3px 8px', cursor: 'pointer', marginRight: '10px' }}>APPROVE</button>}
                      <button onClick={() => handleLockUser(u.email, u.is_locked)} style={{ background: 'transparent', color: u.is_locked ? '#0f0' : 'red', border: `1px solid ${u.is_locked ? '#0f0' : 'red'}`, padding: '3px 8px', cursor: 'pointer', marginRight: '10px' }}>{u.is_locked ? 'UNLOCK' : 'LOCK'}</button>
                      <button onClick={() => handleKickUser(u.email)} style={{ background: 'transparent', color: 'orange', border: '1px solid orange', padding: '3px 8px', cursor: 'pointer' }}>KICK</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Manual Node Provisioning Section */}
          <div className="mt-6 border border-[#008b8b] p-4 bg-black" style={{ border: '1px solid #088', padding: '15px', backgroundColor: '#000' }}>
            <h3 style={{ color: '#0ff', fontSize: '14px', fontWeight: 'bold', margin: '0 0 15px 0' }}> ADD NEW USER </h3>
            <form onSubmit={handleManualAdd} style={{ display: 'flex', gap: '15px' }}>
              <input
                type="text"
                placeholder="Username"
                required
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                style={{ backgroundColor: '#000', border: '1px solid #088', color: '#0ff', padding: '8px 12px', fontSize: '14px', outline: 'none', width: '25%', fontFamily: 'monospace' }}
              />
              <input
                type="email"
                placeholder="User Email"
                required
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                style={{ backgroundColor: '#000', border: '1px solid #088', color: '#0ff', padding: '8px 12px', fontSize: '14px', outline: 'none', width: '33%', fontFamily: 'monospace' }}
              />
              <button
                type="submit"
                style={{ backgroundColor: 'transparent', border: '1px solid #0ff', color: '#0ff', padding: '8px 16px', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'monospace' }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#0ff'; e.currentTarget.style.color = '#000'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#0ff'; }}
              >
                [+] ADD USER
              </button>
            </form>
          </div>

          {/* Security Alerts Section */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid red', paddingBottom: '5px', marginBottom: '10px' }}>
              <h3 style={{ color: 'red', margin: 0 }}>[!] SYSTEM SECURITY ALERTS</h3>
              <button onClick={downloadAuditReport} style={{ background: '#300', color: '#fdd', border: '1px solid red', padding: '5px 10px', cursor: 'pointer' }}>
                [ Download Audit Log ]
              </button>
            </div>
            <div style={{ height: '250px', overflowY: 'auto', border: '1px solid #800', backgroundColor: '#100000', padding: '15px' }}>
              {securityLogs.length === 0 ? (
                <p style={{ color: '#0f0', margin: 0 }}>[+] System is secure. No recent breaches detected.</p>
              ) : (
                securityLogs.map((log, i) => (
                  <div key={i} style={{ borderBottom: '1px dashed #400', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div style={{ color: 'yellow', fontSize: '12px', marginBottom: '5px' }}>[{new Date(log.timestamp).toLocaleString()}]</div>
                    <div style={{ color: '#ff4444', fontSize: '14px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{log.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* AI Copilot Section */}
        <div style={{ flex: 1, border: '1px solid #088', display: 'flex', flexDirection: 'column', height: '80vh' }}>
          <div style={{ padding: '10px', backgroundColor: '#022', borderBottom: '1px solid #088', display: 'flex', justifyContent: 'space-between' }}>
            <strong>SECURITY_COPILOT</strong>
            <span style={{ fontSize: '12px', color: '#088' }}>[AI MODULE]</span>
          </div>
          <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {chatHistory.map((chat, idx) => (
              <div key={idx} style={{ alignSelf: chat.sender === 'ADMIN' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <div style={{ fontSize: '10px', color: '#088', marginBottom: '2px', textAlign: chat.sender === 'ADMIN' ? 'right' : 'left' }}>{chat.sender}</div>
                <div style={{ border: '1px solid #088', padding: '10px', backgroundColor: chat.sender === 'ADMIN' ? '#011' : 'transparent', color: '#0ff' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{chat.text}</pre>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px', borderTop: '1px solid #088', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: '#0f0', marginRight: '10px' }}>{'>'}</span>
            <input 
              type="text" 
              value={command} 
              onChange={(e) => setCommand(e.target.value)} 
              onKeyDown={handleChatSubmit} 
              placeholder="Enter command..." 
              style={{ background: 'transparent', border: 'none', color: '#0ff', width: '100%', outline: 'none', fontFamily: 'monospace' }} 
            />
          </div>
        </div>
        
      </div>
    </div>
  );
}