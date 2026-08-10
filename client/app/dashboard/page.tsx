"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import CryptoJS from "crypto-js";

const SECRET_KEY = "ZeroTrustMasterKey2026";

export default function UserDashboard() {
  const router = useRouter();
  
  // ==========================================
  // SECTION 1: STATE MANAGEMENT
  // ==========================================
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null); 
  const [messages, setMessages] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [requestingFileId, setRequestingFileId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);

  // Initialize User and Clock
  useEffect(() => {
    const userStr = localStorage.getItem("zeroTrustUser");
    if (!userStr) {
      router.push("/login");
    } else {
      setCurrentUser(JSON.parse(userStr));
    }
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("en-US", { hour12: true, hour: '2-digit', minute:'2-digit', second:'2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ==========================================
  // SECTION 2: SAFE DATA FETCHING
  // ==========================================
  
  // Fetch Users Safely (Prevents crashing if DB fails)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("https://zero-trust-project-new.vercel.app/users/approved");
        const data = await res.json();
        // SAFE CHECK: Check if data is actually an array before filtering
        if (Array.isArray(data)) {
          setUsers(data.filter((u: any) => u.email !== currentUser?.email));
        } else {
          console.error("Backend Error: Expected array but got", data);
        }
      } catch (err) {
        console.error("Failed to fetch users");
      }
    };
    if (currentUser) fetchUsers();
    const userInterval = setInterval(() => { if (currentUser) fetchUsers(); }, 5000);
    return () => clearInterval(userInterval);
  }, [currentUser]);

  // Fetch Messages and Files Safely
  const fetchData = async () => {
    if (!currentUser || !selectedContact) return;
    
    // Fetch Messages
    try {
      const msgRes = await fetch("https://zero-trust-project-new.vercel.app/messages/get", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser.email, chat_with: selectedContact.email }),
      });
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        if (Array.isArray(msgData)) {
          const decryptedMessages = msgData.map((msg: any) => {
            try {
              const bytes = CryptoJS.AES.decrypt(msg.content, SECRET_KEY);
              const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
              msg.content = decryptedText || msg.content; 
            } catch (e) { msg.content = "[Encrypted Data]"; }
            return { ...msg, type: 'message' };
          });
          setMessages(decryptedMessages);
        }
      }
    } catch (err) {}

    // Fetch Files
    try {
      const fileRes = await fetch("https://zero-trust-project-new.vercel.app/files/list", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser.email, chat_with: selectedContact.email }),
      });
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        if (Array.isArray(fileData)) {
          setFiles(fileData.map((f:any) => ({...f, type: 'file'})));
        }
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); 
    return () => clearInterval(interval);
  }, [selectedContact, currentUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, files]);


  // ==========================================
  // SECTION 3: USER ACTIONS (MESSAGES & FILES)
  // ==========================================
  
  const handleSendMessage = async (e: any) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedContact) return;
    if (selectedContact.email === 'ai_admin') alert("Security AI is offline. Messages are stored.");

    const encryptedText = CryptoJS.AES.encrypt(messageInput, SECRET_KEY).toString();
    const receiver = selectedContact.email === 'global' ? null : selectedContact.email;

    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/messages/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_email: currentUser.email, receiver_email: receiver, content: encryptedText }),
      });
      if (res.ok) {
        setMessageInput("");
        fetchData();
      } else {
        alert("Failed to send message. Make sure the Vercel backend has updated.");
      }
    } catch (err) { alert("Network connection error."); }
  };

  const handleSendFile = (e: any) => {
    const file = e.target.files[0];
    if (!file || !selectedContact) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64File = event.target?.result as string;
      const encryptedFile = CryptoJS.AES.encrypt(base64File, SECRET_KEY).toString();
      const receiver = selectedContact.email === 'global' ? null : selectedContact.email;
      try {
        const res = await fetch("https://zero-trust-project-new.vercel.app/files/upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender_email: currentUser.email, receiver_email: receiver, file_name: file.name, file_data: encryptedFile }),
        });
        if(res.ok) { alert(`File sent.`); fetchData(); }
      } catch (err) { alert("File upload failed."); }
    };
    reader.readAsDataURL(file);
  };

  const handleRequestOTP = async (fileId: number) => {
    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/files/request-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId, receiver_email: currentUser.email }),
      });
      if(res.ok) {
        alert("OTP sent to your email.");
        setRequestingFileId(fileId);
      }
    } catch (err) { alert("Failed to request OTP."); }
  };

  const handleDownloadFile = async (e: any, fileId: number) => {
    e.preventDefault();
    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/files/download", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId, otp: otpInput }),
      });
      const data = await res.json();
      if (res.ok) {
        const bytes = CryptoJS.AES.decrypt(data.file_data, SECRET_KEY);
        const a = document.createElement("a");
        a.href = bytes.toString(CryptoJS.enc.Utf8);
        a.download = data.file_name;
        a.click();
        setRequestingFileId(null);
        setOtpInput("");
      } else { alert(data.error); }
    } catch (err) { alert("Download failed."); }
  };

  const handleLogout = () => {
    localStorage.removeItem("zeroTrustUser");
    window.location.href = "/login";
  };

  const combinedFeed = [...messages, ...files].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (!currentUser) return <div className="h-screen bg-[#0b141a] text-white flex items-center justify-center">Loading...</div>;

  // ==========================================
  // SECTION 4: UI RENDERING
  // ==========================================
  return (
    <div className="flex h-screen bg-[#0b141a] text-[#e9edef] font-sans">
      
      {/* LEFT SIDEBAR: Contacts */}
      <div className="w-1/3 max-w-[400px] border-r border-[#202c33] flex flex-col bg-[#111b21]">
        <div className="bg-[#202c33] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-600 overflow-hidden flex items-center justify-center text-xl font-bold">
              {currentUser.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-sm">{currentUser.username}</h2>
              <p className="text-[10px] text-green-400">{currentTime}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#111b21]">
          <div onClick={() => setSelectedContact({ username: "Security Admin (AI)", email: "ai_admin" })} className={`flex items-center gap-4 p-4 cursor-pointer border-b border-[#202c33] hover:bg-[#202c33] ${selectedContact?.email === 'ai_admin' ? 'bg-[#2a3942]' : ''}`}>
            <div className="w-12 h-12 rounded-full bg-teal-900 flex items-center justify-center border border-teal-500 text-teal-400">AI</div>
            <div><h3 className="font-bold text-teal-400">Security Admin (AI)</h3><p className="text-xs text-gray-400">Secure automated assistant</p></div>
          </div>
          <div onClick={() => setSelectedContact({ username: "Global Chat Room", email: "global" })} className={`flex items-center gap-4 p-4 cursor-pointer border-b border-[#202c33] hover:bg-[#202c33] ${selectedContact?.email === 'global' ? 'bg-[#2a3942]' : ''}`}>
            <div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center border border-blue-500 text-blue-400">GL</div>
            <div><h3 className="font-bold text-blue-400">Global Chat Room</h3><p className="text-xs text-gray-400">Broadcast to all</p></div>
          </div>

          {users.map(u => (
            <div key={u.email} onClick={() => setSelectedContact(u)} className={`flex items-center gap-4 p-4 cursor-pointer border-b border-[#202c33] hover:bg-[#202c33] ${selectedContact?.email === u.email ? 'bg-[#2a3942]' : ''}`}>
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold">{u.username.charAt(0).toUpperCase()}</div>
              <div><h3 className="font-bold">{u.username}</h3><p className="text-xs text-gray-400">{u.email}</p></div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT SIDEBAR: Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[#0b141a]">
        {!selectedContact ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
            <h1 className="text-4xl font-light mb-4">Zero Trust Workspace</h1>
            <p className="text-gray-400">Select a contact to start an encrypted conversation.</p>
          </div>
        ) : (
          <>
            <div className="bg-[#202c33] p-4 flex items-center gap-4 border-b border-[#111b21]">
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold">{selectedContact.username.charAt(0).toUpperCase()}</div>
              <div>
                <h2 className="font-bold">{selectedContact.username}</h2>
                <p className="text-xs text-green-500">End-to-End Encrypted Connection</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-[#0b141a]">
              {combinedFeed.map((item, index) => {
                const isMine = item.sender_email === currentUser.email;
                if (item.type === 'message') {
                  return (
                    <div key={`msg-${index}`} className={`flex flex-col max-w-[65%] ${isMine ? 'self-end' : 'self-start'}`}>
                      <div className={`p-3 rounded-lg shadow ${isMine ? 'bg-[#005c4b] rounded-tr-none' : 'bg-[#202c33] rounded-tl-none'}`}>
                        <p className="text-sm break-words">{item.content}</p>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={`file-${index}`} className={`flex flex-col max-w-[70%] ${isMine ? 'self-end' : 'self-start'}`}>
                      <div className={`bg-[#202c33] p-4 rounded-lg shadow border border-gray-700 ${isMine ? 'bg-[#005c4b] rounded-tr-none' : 'bg-[#202c33] rounded-tl-none'}`}>
                        <p className="font-bold text-sm text-blue-400">📎 {item.file_name}</p>
                        {isMine ? <p className="text-xs text-green-300 mt-2">Encrypted & Sent</p> : requestingFileId === item.id ? (
                          <form onSubmit={(e) => handleDownloadFile(e, item.id)} className="flex gap-2 mt-2">
                            <input type="text" placeholder="OTP" value={otpInput} onChange={(e) => setOtpInput(e.target.value)} required className="bg-[#2a3942] w-24 text-center text-white rounded p-1" />
                            <button type="submit" className="bg-green-600 px-3 py-1 rounded text-xs font-bold">Unlock</button>
                          </form>
                        ) : <button onClick={() => handleRequestOTP(item.id)} className="bg-blue-600 px-4 py-2 rounded text-xs font-bold mt-2">Request OTP to Download</button>}
                      </div>
                    </div>
                  );
                }
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="bg-[#202c33] p-4 flex items-center gap-4">
              <div className="text-gray-400 cursor-pointer" onClick={() => fileUploadInputRef.current?.click()}>📎</div>
              <input type="file" ref={fileUploadInputRef} className="hidden" onChange={handleSendFile} />
              <form onSubmit={handleSendMessage} className="flex-1 flex gap-4">
                <input type="text" value={messageInput} onChange={e => setMessageInput(e.target.value)} placeholder="Type a message..." className="flex-1 bg-[#2a3942] text-white px-4 py-3 rounded-lg focus:outline-none" />
                <button type="submit" className="bg-[#00a884] text-white p-3 rounded-full">→</button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}