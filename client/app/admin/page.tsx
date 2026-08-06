"use client";
import React, { useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  email: string;
  last_login_ip: string | null;
  last_login_time: string | null;
  session_active: boolean;
  is_locked: boolean;
}

interface ChatMessage {
  sender: 'ADMIN' | 'AI';
  text: string;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [command, setCommand] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { sender: 'AI', text: 'SECURITY COPILOT INITIALIZED. AWAITING COMMANDS...' }
  ]);
  
  // NEW: State to track if lockdown is active or not
  const [isLockdown, setIsLockdown] = useState<boolean>(false);

  const API_URL = "https://zero-trust-project-new.vercel.app";

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`);
      if (res.ok) {
        const data: User[] = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleKickUser = async (email: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/user/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action: 'kick' })
      });
      if (res.ok) {
        alert(`User ${email} kicked successfully!`);
        fetchUsers();
      }
    } catch (error) {
      console.error("Error kicking user:", error);
    }
  };

  const handleLockUser = async (email: string, currentStatus: boolean) => {
    const action = currentStatus ? 'unlock' : 'lock';
    try {
      const res = await fetch(`${API_URL}/admin/user/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action })
      });
      if (res.ok) fetchUsers();
    } catch (error) {
      console.error("Error updating user status:", error);
    }
  };

  // UPDATED: Toggle Lockdown Function
  const handleLockdown = async () => {
    const actionText = isLockdown ? "LIFT the SYSTEM LOCKDOWN?" : "INITIATE SYSTEM LOCKDOWN? All user connections will be severed.";
    const confirmLockdown = window.confirm(`WARNING: Are you sure you want to ${actionText}`);
    
    if (!confirmLockdown) return;

    try {
      const newState = !isLockdown; // Flip the state (true -> false, false -> true)
      const res = await fetch(`${API_URL}/admin/system/lockdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: newState }) 
      });
      const data = await res.json();
      alert(data.message);
      
      setIsLockdown(newState); // Update the button UI
      fetchUsers();
    } catch (error) {
      console.error("Lockdown execution failed:", error);
    }
  };

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
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '18px', color: '#0f0' }}>{new Date().toLocaleString()}</p>
          <p style={{ margin: 0, color: '#088' }}>SECURE CONNECTION ESTABLISHED</p>
          
          {/* UPDATED: Dynamic Button UI */}
          <button 
            onClick={handleLockdown}
            style={{ 
              marginTop: '10px', 
              padding: '8px 15px', 
              backgroundColor: isLockdown ? '#006400' : '#800000', 
              color: '#fff', 
              border: `1px solid ${isLockdown ? '#0f0' : 'red'}`, 
              cursor: 'pointer', 
              fontWeight: 'bold' 
            }}>
            {isLockdown ? '✅ LIFT LOCKDOWN ✅' : '⚠️ INITIATE LOCKDOWN ⚠️'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        
        <div style={{ flex: 2 }}>
          <div style={{ border: '1px solid #088', padding: '15px', marginBottom: '20px' }}>
            <span style={{ marginRight: '15px' }}>ADD_NODE:</span>
            <input type="text" placeholder="Username" style={{ background: 'transparent', border: '1px solid #088', color: '#0ff', padding: '5px', marginRight: '10px' }} />
            <input type="text" placeholder="Email Address" style={{ background: 'transparent', border: '1px solid #088', color: '#0ff', padding: '5px', marginRight: '10px' }} />
            <button style={{ background: '#0ff', color: '#000', padding: '6px 15px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>EXECUTE</button>
          </div>

          <button style={{ background: 'transparent', color: '#0ff', border: '1px solid #0ff', padding: '5px 15px', marginBottom: '20px', cursor: 'pointer' }}>
            [ DOWNLOAD_LOGS.CSV ]
          </button>

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
                    <span style={{ color: user.session_active ? '#0f0' : '#888', border: `1px solid ${user.session_active ? '#0f0' : '#888'}`, padding: '2px 5px', fontSize: '12px' }}>
                      {user.session_active ? 'ACTIVE' : 'OFFLINE'}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <button 
                      onClick={() => handleLockUser(user.email, user.is_locked)}
                      style={{ background: 'transparent', color: user.is_locked ? '#0f0' : 'red', border: `1px solid ${user.is_locked ? '#0f0' : 'red'}`, padding: '3px 8px', cursor: 'pointer', marginRight: '10px' }}>
                      {user.is_locked ? 'UNLOCK' : 'LOCK'}
                    </button>
                    <button 
                      onClick={() => handleKickUser(user.email)}
                      style={{ background: 'transparent', color: 'orange', border: '1px solid orange', padding: '3px 8px', cursor: 'pointer' }}>
                      KICK
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ flex: 1, border: '1px solid #088', display: 'flex', flexDirection: 'column', height: '70vh' }}>
          <div style={{ padding: '10px', backgroundColor: '#022', borderBottom: '1px solid #088', display: 'flex', justifyContent: 'space-between' }}>
            <strong>SECURITY_COPILOT</strong>
            <span style={{ fontSize: '12px', color: '#088' }}>[AI MODULE]</span>
          </div>
          
          <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {chatHistory.map((chat, idx) => (
              <div key={idx} style={{ alignSelf: chat.sender === 'ADMIN' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <div style={{ fontSize: '10px', color: '#088', marginBottom: '2px', textAlign: chat.sender === 'ADMIN' ? 'right' : 'left' }}>
                  {chat.sender}
                </div>
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