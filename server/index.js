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
  
  const [deviceWarning, setDeviceWarning] = useState(false);
  const [deviceOtp, setDeviceOtp] = useState("");
  const [currentIpAddress, setCurrentIpAddress] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // ZERO TRUST: IP-BASED VERIFICATION ("IS THIS YOU?")
  // ==========================================
  useEffect(() => {
    const userStr = localStorage.getItem("zeroTrustUser");
    if (!userStr) {
      router.push("/login");
    } else {
      const parsedUser = JSON.parse(userStr);
      setCurrentUser(parsedUser);

      const checkIpChange = async () => {
        try {
          const res = await fetch("https://api.ipify.org?format=json");
          const data = await res.json();
          const currentIp = data.ip;
          
          setCurrentIpAddress(currentIp); 
          
          const savedIp = localStorage.getItem("trustedIpAddress");

          if (!savedIp) {
            localStorage.setItem("trustedIpAddress", currentIp);
          } else if (savedIp !== currentIp) {
            // BYPASSED
            setDeviceWarning(false); 
          }
        } catch (error) {
          console.error("Failed to fetch IP address.");
        }
      };

      checkIpChange();
    }

    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("en-US", { hour12: true, hour: '2-digit', minute:'2-digit', second:'2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ==========================================
  // ZERO TRUST: AUTO SESSION TIMEOUT (5 Mins)
  // ==========================================
  useEffect(() => {
    if (deviceWarning) return; 

    let timeout: NodeJS.Timeout;
    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        alert("🔒 Zero Trust Security: You have been logged out due to inactivity.");
        localStorage.removeItem("zeroTrustUser");
        window.location.href = "/login"; 
      }, 300000); 
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click'];
    events.forEach(event => window.addEventListener(event, resetTimeout));
    resetTimeout(); 

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimeout));
      clearTimeout(timeout);
    };
  }, [deviceWarning]);

  // ==========================================
  // SECTION 2: SAFE DATA FETCHING
  // ==========================================
  useEffect(() => {
    if (deviceWarning) return; 

    const fetchUsers = async () => {
      try {
        const res = await fetch("https://zero-trust-project-new.vercel.app/users/approved");
        const data = await res.json();
        // FIX: Admin wa users list eken ain kala (mokada admin ta wenama button ekak udata dapu nisa)
        if (Array.isArray(data)) {
            setUsers(data.filter((u: any) => u.email !== currentUser?.email && u.email !== 'zerotrust.admin@gmail.com'));
        }
      } catch (err) {}
    };
    if (currentUser) fetchUsers();
    const userInterval = setInterval(() => { if (currentUser) fetchUsers(); }, 5000);
    return () => clearInterval(userInterval);
  }, [currentUser, deviceWarning]);

  const fetchData = async () => {
    if (!currentUser || !selectedContact || deviceWarning) return;
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
              msg.content = bytes.toString(CryptoJS.enc.Utf8) || msg.content; 
            } catch (e) { msg.content = "[Encrypted Data]"; }
            return { ...msg, type: 'message' };
          });
          setMessages(decryptedMessages);
        }
      }
    } catch (err) {}

    try {
      const fileRes = await fetch("https://zero-trust-project-new.vercel.app/files/list", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser.email, chat_with: selectedContact.email }),
      });
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        if (Array.isArray(fileData)) setFiles(fileData.map((f:any) => ({...f, type: 'file'})));
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); 
    return () => clearInterval(interval);
  }, [selectedContact, currentUser, deviceWarning]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, files]);


  // ==========================================
  // SECTION 3: USER ACTIONS
  // ==========================================
  const handleVerifyDevice = (e: any) => {
    e.preventDefault();
    if (deviceOtp === "123456") {
      alert("✅ Location Verified Successfully! This IP is now trusted.");
      localStorage.setItem("trustedIpAddress", currentIpAddress); 
      setDeviceWarning(false);
    } else {
      alert("❌ Invalid verification code. Access Denied.");
    }
  };

  const handleSendMessage = async (e: any) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedContact) return;
    
    // FIX: AI alert eka ain kala mokada dan katha karanne Human Admin ekka
    const encryptedText = CryptoJS.AES.encrypt(messageInput, SECRET_KEY).toString();
    const receiver = selectedContact.email === 'global' ? null : selectedContact.email;

    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/messages/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_email: currentUser.email, receiver_email: receiver, content: encryptedText }),
      });
      if (res.ok) { setMessageInput(""); fetchData(); }
    } catch (err) {}
  };

  const handleSendFile = (e: any) => {
    const file = e.target.files[0];
    if (!file || !selectedContact) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const encryptedFile = CryptoJS.AES.encrypt(event.target?.result as string, SECRET_KEY).toString();
      const receiver = selectedContact.email === 'global' ? null : selectedContact.email;
      try {
        const res = await fetch("https://zero-trust-project-new.vercel.app/files/upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender_email: currentUser.email, receiver_email: receiver, file_name: file.name, file_data: encryptedFile }),
        });
        if(res.ok) { alert(`File sent.`); fetchData(); }
      } catch (err) {}
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
        alert("OTP sent to your email! (Please check your Inbox)");
        setRequestingFileId(fileId);
      } else { alert("Failed to send OTP."); }
    } catch (err) { alert("Network connection error."); }
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
        setRequestingFileId(null); setOtpInput("");
      } else { alert(data.error); }
    } catch (err) { alert("Download failed."); }
  };

  const handleLogout = () => {
    localStorage.removeItem("zeroTrustUser");
    window.location.href = "/login";
  };

  const handleProfilePicChange = (e: any) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Pic = event.target?.result as string;
      try {
        const res = await fetch("https://zero-trust-project-new.vercel.app/user/profile-pic", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: currentUser.email, profilePicture: base64Pic }),
        });
        if (res.ok) {
          const updatedUser = { ...currentUser, profile_picture: base64Pic };
          setCurrentUser(updatedUser);
          localStorage.setItem("zeroTrustUser", JSON.stringify(updatedUser));
          alert("Profile picture updated securely.");
        }
      } catch (err) {}
    };
    reader.readAsDataURL(file);
  };

  const combinedFeed = [...messages, ...files].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (!currentUser) return <div className="h-screen bg-[#0b141a] text-white flex items-center justify-center">Loading...</div>;

  if (deviceWarning) {
    return (
      <div className="flex h-screen bg-[#0b141a] text-white items-center justify-center font-sans">
        <div className="bg-[#111b21] p-8 rounded-lg text-center border-t-4 border-red-500 max-w-md shadow-2xl">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-red-500 text-2xl font-bold mb-2">Unrecognized Location / IP</h2>
          <p className="mb-6 text-sm text-gray-400">
            You are trying to access the Zero Trust Workspace from a new IP Address. To maintain security, an <b>"Is this you?"</b> verification code has been sent to <b>{currentUser?.email}</b>.
          </p>
          <form onSubmit={handleVerifyDevice}>
            <input type="text" placeholder="Enter 6-Digit Code" required maxLength={6} value={deviceOtp} onChange={(e)=>setDeviceOtp(e.target.value)} className="w-full bg-[#2a3942] text-white border border-gray-600 focus:border-blue-500 p-3 rounded mb-4 text-center tracking-[0.5em] text-lg outline-none" />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 p-3 rounded font-bold transition-colors">Verify & Trust Location</button>
          </form>
          <button onClick={handleLogout} className="mt-6 text-sm text-gray-500 hover:text-gray-300 underline">Cancel and Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0b141a] text-[#e9edef] font-sans">
      {/* LEFT SIDEBAR */}
      <div className="w-1/3 max-w-[400px] border-r border-[#202c33] flex flex-col bg-[#111b21]">
        <div className="bg-[#202c33] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-600 overflow-hidden flex items-center justify-center text-xl font-bold cursor-pointer hover:opacity-80" onClick={() => profilePicInputRef.current?.click()} title="Click to change Profile Picture">
              {currentUser.profile_picture ? <img src={currentUser.profile_picture} alt="DP" className="w-full h-full object-cover" /> : currentUser.username.charAt(0).toUpperCase()}
            </div>
            <input type="file" accept="image/*" ref={profilePicInputRef} className="hidden" onChange={handleProfilePicChange} />
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
          {/* FIX: AI Admin eka wenuwata Human Admin wa damma */}
          <div onClick={() => setSelectedContact({ username: "System Admin", email: "zerotrust.admin@gmail.com" })} className={`flex items-center gap-4 p-4 cursor-pointer border-b border-[#202c33] hover:bg-[#202c33] ${selectedContact?.email === 'zerotrust.admin@gmail.com' ? 'bg-[#2a3942]' : ''}`}>
            <div className="w-12 h-12 rounded-full bg-teal-900 flex items-center justify-center border border-teal-500 text-teal-400 font-bold">AD</div>
            <div><h3 className="font-bold text-teal-400">System Admin</h3><p className="text-xs text-gray-400">Human Administrator</p></div>
          </div>
          
          <div onClick={() => setSelectedContact({ username: "Global Chat Room", email: "global" })} className={`flex items-center gap-4 p-4 cursor-pointer border-b border-[#202c33] hover:bg-[#202c33] ${selectedContact?.email === 'global' ? 'bg-[#2a3942]' : ''}`}>
            <div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center border border-blue-500 text-blue-400 font-bold">GL</div>
            <div><h3 className="font-bold text-blue-400">Global Chat Room</h3><p className="text-xs text-gray-400">Broadcast to all</p></div>
          </div>

          {users.map(u => (
            <div key={u.email} onClick={() => setSelectedContact(u)} className={`flex items-center gap-4 p-4 cursor-pointer border-b border-[#202c33] hover:bg-[#202c33] ${selectedContact?.email === u.email ? 'bg-[#2a3942]' : ''}`}>
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden text-xl font-bold">
                {u.profile_picture ? <img src={u.profile_picture} alt="DP" className="w-full h-full object-cover" /> : u.username.charAt(0).toUpperCase()}
              </div>
              <div><h3 className="font-bold">{u.username}</h3><p className="text-xs text-gray-400">{u.email}</p></div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="flex-1 flex flex-col relative bg-[#0b141a]">
        {!selectedContact ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
            <h1 className="text-4xl font-light mb-4">Zero Trust Workspace</h1>
            <p className="text-gray-400">Select a contact to start an encrypted conversation.</p>
          </div>
        ) : (
          <>
            <div className="bg-[#202c33] p-4 flex items-center gap-4 border-b border-[#111b21]">
              <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center text-lg font-bold">
                {selectedContact.email === 'global' ? 'GL' : selectedContact.email === 'zerotrust.admin@gmail.com' ? 'AD' : selectedContact.profile_picture ? <img src={selectedContact.profile_picture} className="w-full h-full object-cover" /> : selectedContact.username.charAt(0).toUpperCase()}
              </div>
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
                    <div key={`file-${item.id}`} className={`flex flex-col max-w-[70%] ${isMine ? 'self-end' : 'self-start'}`}>
                      <div className={`bg-[#202c33] p-4 rounded-lg shadow border border-gray-700 ${isMine ? 'bg-[#005c4b] rounded-tr-none' : 'bg-[#202c33] rounded-tl-none'}`}>
                        <p className="font-bold text-sm text-blue-400">📎 {item.file_name}</p>
                        
                        {isMine ? (
                          <p className="text-xs text-green-300 mt-2">Encrypted & Sent</p>
                        ) : requestingFileId === item.id ? (
                          <div className="mt-3 flex flex-col gap-2">
                            <form onSubmit={(e) => handleDownloadFile(e, item.id)} className="flex gap-2">
                              <input type="text" placeholder="OTP" value={otpInput} onChange={(e) => setOtpInput(e.target.value)} required className="bg-[#2a3942] w-24 text-center text-white rounded p-1" />
                              <button type="submit" className="bg-green-600 hover:bg-green-500 transition-colors px-3 py-1 rounded text-xs font-bold">Unlock</button>
                            </form>
                            <div className="flex gap-4 mt-1 text-[11px] font-bold">
                              <button onClick={() => handleRequestOTP(item.id)} className="text-blue-400 hover:text-blue-300 underline">Resend OTP</button>
                              <button onClick={() => {setRequestingFileId(null); setOtpInput("");}} className="text-red-400 hover:text-red-300 underline">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => handleRequestOTP(item.id)} className="bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-2 rounded text-xs font-bold mt-2 w-full text-center">Request OTP to Download</button>
                        )}
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