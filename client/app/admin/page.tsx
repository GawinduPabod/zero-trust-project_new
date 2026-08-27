"use client";
import React, { useState, useEffect } from 'react';

// TypeScript Interfaces
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
  const [users, setUsers] = useState<User[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [command, setCommand] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { sender: 'AI', text: 'SECURITY COPILOT INITIALIZED. AWAITING COMMANDS...' }
  ]);
  
  const [isLockdown, setIsLockdown] = useState<boolean>(false);

  const API_URL = "https://zero-trust-project-new.vercel.app";

  const fetchData = async () => {
    try {
      const resUsers = await fetch(`${API_URL}/admin/users`);
      if (resUsers.ok) {
        const dataUsers: User[] = await resUsers.json();
        setUsers(dataUsers);
      }

      const resLogs = await fetch(`${API_URL}/admin/logs/messages`);
      if (resLogs.ok) {
        const dataLogs = await resLogs.json();
        const alerts = dataLogs.filter((log: any) => log.sender_email === 'ai_admin');
        setSecurityLogs(alerts);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); 
    return () => clearInterval(interval);
  }, []);

  const handleApproveUser = async (email: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/user/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action: 'approve' })
      });
      if (res.ok) fetchData();
    } catch (error) { console.error(error); }
  };

  const handleKickUser = async (email: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/user/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action: 'kick' })
      });
      if (res.ok) { alert(`User ${email} kicked successfully!`); fetchData(); }
    } catch (error) { console.error(error); }
  };

  const handleLockUser = async (email: string, currentStatus: boolean) => {
    const action = currentStatus ? 'unlock' : 'lock';
    try {
      const res = await fetch(`${API_URL}/admin/user/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action })
      });
      if (res.ok) fetchData();
    } catch (error) { console.error(error); }
  };

  const handleLockdown = async () => {
    const actionText = isLockdown ? "LIFT the SYSTEM LOCKDOWN?" : "INITIATE SYSTEM LOCKDOWN? All user connections will be severed.";
    const confirmLockdown = window.confirm(`WARNING: Are you sure you want to ${actionText}`);
    if (!confirmLockdown) return;

    try {
      const newState = !isLockdown; 
      const res = await fetch(`${API_URL}/admin/system/lockdown`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: newState }) 
      });
      const data = await res.json();
      alert(data.message);
      setIsLockdown(newState); 
      fetchData();
    } catch (error) { console.error(error); }
  };

  // ==========================================
  // NEW: DDoS / STRESS TEST SIMULATOR FUNCTION
  // ==========================================
  const handleSimulateAttack = async () => {
    const confirmAttack = window.confirm("Are you sure you want to simulate a high-traffic DDoS / Brute-Force attack?");
    if (!confirmAttack) return;
    
    alert("Attack simulation started! Sending multiple unauthorized login requests...");
    
    // ව්‍යාජ රික්වෙස්ට් 20ක් එකපාර යවනවා
    for (let i = 0; i < 20; i++) {
        fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: `fake_hacker_${i}@gmail.com`, username: "hacker", location: "Unknown" })
        }).catch(e => console.log("Attack blocked by network"));
    }
    
    // තත්පර 3කට පස්සේ Dashboard එක Update කරනවා AI Alert එක පෙන්වන්න
    setTimeout(() => {
        alert("Attack blocked by Zero Trust Firewall! Check your Security Alerts below.");
        fetchData();
    }, 3000);
  };

  const handleChatSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && command.trim() !== '') {
      const newChat: ChatMessage[] = [...chatHistory, { sender: 'ADMIN', text: command }];
      setChatHistory(newChat);
      setCommand('');
      
      try {
        const res = await fetch(`${API_URL}/admin/copilot/chat`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: command })
        });
        const data = await res.json();
        setChatHistory([...newChat, { sender: 'AI', text: data.response }]);
      } catch (error) {
        setChatHistory([...newChat, { sender: 'AI', text: 'ERROR: CONNECTION TO ZERO TRUST CORE FAILED.' }]);
      }
    }
  };

  return (
    <div style={{ backgroundColor: '#000', color: '#0ff', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #0ff', paddingBottom: '10px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', margin: 0, textShadow: '0 0 5px #0ff' }}>SYSTEM_ADMIN_PANEL</h1>
          <p style={{ margin: 0, color: '#088' }}>Zero Trust Security Workspace</p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <p style={{ margin: 0, fontSize: '18px', color: '#0f0' }}>{new Date().toLocaleString()}</p>
          <p style={{ margin: 0, color: '#088' }}>SECURE CONNECTION ESTABLISHED</p>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            {/* NEW: STRESS TEST BUTTON */}
            <button 
              onClick={handleSimulateAttack}
              style={{ padding: '8px 15px', backgroundColor: '#500', color: '#fff', border: '1px solid #f00', cursor: 'pointer', fontWeight: 'bold' }}>
              ⚠️ SIMULATE DDoS ATTACK
            </button>

            <button 
              onClick={handleLockdown}
              style={{ padding: '8px 15px', backgroundColor: isLockdown ? '#006400' : '#800000', color: '#fff', border: `1px solid ${isLockdown ? '#0f0' : 'red'}`, cursor: 'pointer', fontWeight: 'bold' }}>
              {isLockdown ? '✅ LIFT LOCKDOWN ✅' : '⚠️ INITIATE LOCKDOWN ⚠️'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        
        {/* LEFT COLUMN: Users & Logs */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* USER TABLE */}
          <div>
            <h3 style={{ color: '#0ff', margin: '0 0 10px 0' }}>// ACTIVE NODES (USERS)</h3>
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
                {users.map((user, index) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #044' }}>
                    <td style={{ padding: '10px', color: '#088' }}>#{index + 1}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 'bold', color: '#fff' }}>{user.username}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>{user.email}</div>
                    </td>
                    <td style={{ padding: '10px', fontSize: '12px' }}>
                      <div>IP: <span style={{ color: '#0ff' }}>{user.last_login_ip || 'NULL'}</span></div>
                      <div>{user.last_login_time ? new Date(user.last_login_time).toLocaleDateString() : 'NEVER'}</div>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ color: user.status === 'approved' ? '#0f0' : 'yellow', fontSize: '12px', marginBottom: '5px' }}>
                        [{user.status ? user.status.toUpperCase() : 'UNKNOWN'}]
                      </div>
                      <span style={{ color: user.session_active ? '#0f0' : '#888', border: `1px solid ${user.session_active ? '#0f0' : '#888'}`, padding: '2px 5px', fontSize: '10px' }}>
                        {user.session_active ? 'ACTIVE' : 'OFFLINE'}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {user.status !== 'approved' && (
                        <button onClick={() => handleApproveUser(user.email)} style={{ background: 'transparent', color: '#0ff', border: '1px solid #0ff', padding: '3px 8px', cursor: 'pointer', marginRight: '10px' }}>APPROVE</button>
                      )}
                      <button onClick={() => handleLockUser(user.email, user.is_locked)} style={{ background: 'transparent', color: user.is_locked ? '#0f0' : 'red', border: `1px solid ${user.is_locked ? '#0f0' : 'red'}`, padding: '3px 8px', cursor: 'pointer', marginRight: '10px' }}>
                        {user.is_locked ? 'UNLOCK' : 'LOCK'}
                      </button>
                      <button onClick={() => handleKickUser(user.email)} style={{ background: 'transparent', color: 'orange', border: '1px solid orange', padding: '3px 8px', cursor: 'pointer' }}>KICK</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SECURITY ALERTS LOGS */}
          <div style={{ marginTop: '10px' }}>
            <h3 style={{ color: 'red', borderBottom: '1px solid red', paddingBottom: '5px', margin: '0 0 10px 0' }}>🚨 SYSTEM SECURITY ALERTS</h3>
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

        {/* RIGHT COLUMN: AI Copilot */}
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