"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import CryptoJS from "crypto-js";

const SECRET_KEY = "ZeroTrustMasterKey2026";

export default function UserDashboard() {
  const router = useRouter();
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

  //// 1. Load User & Live Clock
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

  //// 2. Fetch Users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("https://zero-trust-project-new.vercel.app//users/approved");
        const data = await res.json();
        setUsers(data.filter((u: any) => u.email !== currentUser?.email));
      } catch (err) {
        console.error("Failed to fetch users");
      }
    };
    if (currentUser) fetchUsers();
    const userInterval = setInterval(() => { if (currentUser) fetchUsers(); }, 5000);
    return () => clearInterval(userInterval);
  }, [currentUser]);

  //// 3. Fetch Messages & Files for Selected Contact
  const fetchData = async () => {
    if (!currentUser || !selectedContact) return;
    try {
      // Fetch Messages
      const msgRes = await fetch("https://zero-trust-project-new.vercel.app//messages/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser.email, chat_with: selectedContact.email }),
      });
      const msgData = await msgRes.json();
      
      const decryptedMessages = msgData.map((msg: any) => {
        try {
          const bytes = CryptoJS.AES.decrypt(msg.content, SECRET_KEY);
          msg.content = bytes.toString(CryptoJS.enc.Utf8);
        } catch (e) {
          msg.content = "[Encrypted Data]";
        }
        return { ...msg, type: 'message' };
      });
      setMessages(decryptedMessages);

      // Fetch Files
      const fileRes = await fetch("https://zero-trust-project-new.vercel.app//files/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser.email, chat_with: selectedContact.email }),
      });
      const fileData = await fileRes.json();
      const formattedFiles = fileData.map((f:any) => ({...f, type: 'file'}));
      setFiles(formattedFiles);
      
    } catch (err) {
      console.error("Fetch Data Error");
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); 
    return () => clearInterval(interval);
  }, [selectedContact, currentUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, files]);

  //// 4. Update Profile Picture
  const handleProfilePicChange = (e: any) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Pic = event.target?.result as string;
      try {
        const res = await fetch("https://zero-trust-project-new.vercel.app//user/profile-pic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: currentUser.email, profilePicture: base64Pic }),
        });
        
        if (res.ok) {
          const updatedUser = { ...currentUser, profile_picture: base64Pic };
          setCurrentUser(updatedUser);
          localStorage.setItem("zeroTrustUser", JSON.stringify(updatedUser));
          alert("Profile picture updated securely.");
        } else {
          alert("Failed to update on server.");
        }
      } catch (err) {
        alert("Server connection failed.");
      }
    };
    reader.readAsDataURL(file);
  };

  //// 5. Send Message
  const handleSendMessage = async (e: any) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedContact) return;

    if (selectedContact.email === 'ai_admin') {
       alert("Security AI is currently offline for maintenance. Messages will be stored.");
    }

    const encryptedText = CryptoJS.AES.encrypt(messageInput, SECRET_KEY).toString();
    const receiver = selectedContact.email === 'global' ? null : selectedContact.email;

    try {
      await fetch("https://zero-trust-project-new.vercel.app//messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_email: currentUser.email,
          receiver_email: receiver,
          content: encryptedText, 
        }),
      });
      setMessageInput("");
      fetchData();
    } catch (err) {
      console.error("Send Message Error");
    }
  };

  //// 6. Send Encrypted File
  const handleSendFile = (e: any) => {
    const file = e.target.files[0];
    if (!file || !selectedContact) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64File = event.target?.result as string;
      const encryptedFile = CryptoJS.AES.encrypt(base64File, SECRET_KEY).toString();
      const receiver = selectedContact.email === 'global' ? null : selectedContact.email;

      try {
        await fetch("https://zero-trust-project-new.vercel.app//files/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender_email: currentUser.email,
            receiver_email: receiver,
            file_name: file.name,
            file_data: encryptedFile, 
          }),
        });
        alert(`Encrypted file '${file.name}' sent successfully.`);
        fetchData(); 
      } catch (err) {
        alert("File upload failed.");
      }
    };
    reader.readAsDataURL(file);
  };

  //// 7. Request & Verify OTP for Files
  const handleRequestOTP = async (fileId: number) => {
    try {
      await fetch("https://zero-trust-project-new.vercel.app//files/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId, receiver_email: currentUser.email }),
      });
      alert("An OTP has been sent to your email to unlock this file.");
      setRequestingFileId(fileId);
    } catch (err) {
      alert("Failed to request OTP.");
    }
  };

  const handleDownloadFile = async (e: any, fileId: number) => {
    e.preventDefault();
    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app//files/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId, otp: otpInput }),
      });
      const data = await res.json();

      if (res.ok) {
        const bytes = CryptoJS.AES.decrypt(data.file_data, SECRET_KEY);
        const decryptedBase64 = bytes.toString(CryptoJS.enc.Utf8);

        const a = document.createElement("a");
        a.href = decryptedBase64;
        a.download = data.file_name;
        a.click();
        
        setRequestingFileId(null);
        setOtpInput("");
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Download failed.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("zeroTrustUser");
    window.location.href = "/login";
  };

  const combinedFeed = [...messages, ...files].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (!currentUser) return <div className="h-screen bg-[#0b141a] text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="flex h-screen bg-[#0b141a] text-[#e9edef] font-sans">
      
      {/* LEFT SIDEBAR */}
      <div className="w-1/3 max-w-[400px] border-r border-[#202c33] flex flex-col bg-[#111b21]">
        
        <div className="bg-[#202c33] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full bg-gray-600 cursor-pointer overflow-hidden border border-gray-500 hover:opacity-80 flex items-center justify-center text-xl font-bold"
              onClick={() => profilePicInputRef.current?.click()}
              title="Click to change Profile Picture"
            >
              {currentUser.profile_picture ? (
                <img src={currentUser.profile_picture} alt="DP" className="w-full h-full object-cover" />
              ) : (
                currentUser.username.charAt(0).toUpperCase()
              )}
            </div>
            <input type="file" accept="image/*" ref={profilePicInputRef} className="hidden" onChange={handleProfilePicChange} />
            
            <div>
              <h2 className="font-bold text-sm">{currentUser.username}</h2>
              <p className="text-[10px] text-green-400">{currentTime}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-400" title="Logout">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#111b21]">
          {/* AI Security Admin Chat */}
          <div 
            onClick={() => setSelectedContact({ username: "Security Admin (AI)", email: "ai_admin" })}
            className={`flex items-center gap-4 p-4 cursor-pointer border-b border-[#202c33] hover:bg-[#202c33] ${selectedContact?.email === 'ai_admin' ? 'bg-[#2a3942]' : ''}`}
          >
            <div className="w-12 h-12 rounded-full bg-teal-900 flex items-center justify-center border border-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.5)] text-teal-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            </div>
            <div>
              <h3 className="font-bold text-teal-400">Security Admin (AI)</h3>
              <p className="text-xs text-gray-400">Secure automated assistant</p>
            </div>
          </div>

          {/* Global Chat Item */}
          <div 
            onClick={() => setSelectedContact({ username: "Global Chat Room", email: "global" })}
            className={`flex items-center gap-4 p-4 cursor-pointer border-b border-[#202c33] hover:bg-[#202c33] ${selectedContact?.email === 'global' ? 'bg-[#2a3942]' : ''}`}
          >
            <div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center border border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] text-blue-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
              <h3 className="font-bold text-blue-400">Global Chat Room</h3>
              <p className="text-xs text-gray-400">Broadcast to all active users</p>
            </div>
          </div>

          {/* User Items */}
          {users.map(u => (
            <div 
              key={u.email} 
              onClick={() => setSelectedContact(u)}
              className={`flex items-center gap-4 p-4 cursor-pointer border-b border-[#202c33] hover:bg-[#202c33] transition-colors ${selectedContact?.email === u.email ? 'bg-[#2a3942]' : ''}`}
            >
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden text-xl font-bold">
                {u.profile_picture ? (
                  <img src={u.profile_picture} alt="DP" className="w-full h-full object-cover" />
                ) : (
                  u.username.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h3 className="font-bold">{u.username}</h3>
                <p className="text-xs text-gray-400">{u.email}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col relative bg-[#0b141a]">
        
        {!selectedContact ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
            <h1 className="text-4xl font-light mb-4">Zero Trust Workspace</h1>
            <p className="text-gray-400">Select a contact or the AI Admin to start an encrypted conversation.</p>
            <p className="text-gray-500 text-sm mt-4">All messages and files are secured with AES encryption.</p>
          </div>
        ) : (
          <>
            <div className="bg-[#202c33] p-4 flex items-center gap-4 border-b border-[#111b21]">
              <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center text-lg font-bold text-gray-300">
                {selectedContact.email === 'global' ? (
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                ) : selectedContact.email === 'ai_admin' ? (
                  <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                ) : (
                  selectedContact.profile_picture ? <img src={selectedContact.profile_picture} className="w-full h-full object-cover" /> : selectedContact.username.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h2 className="font-bold">{selectedContact.username}</h2>
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path></svg>
                  End-to-End Encrypted Connection
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-[#0b141a]">
              <div className="text-center text-xs text-yellow-500 bg-[#182229] p-2 rounded w-max mx-auto mb-4 border border-yellow-900/50">
                Messages to this chat and calls are now secured with Zero Trust Architecture.
              </div>

              {combinedFeed.map((item, index) => {
                const isMine = item.sender_email === currentUser.email;
                
                if (item.type === 'message') {
                  return (
                    <div key={`msg-${item.id}-${index}`} className={`flex flex-col max-w-[65%] ${isMine ? 'self-end' : 'self-start'}`}>
                      {!isMine && selectedContact.email === 'global' && <span className="text-[10px] text-gray-400 ml-1">{item.sender_email}</span>}
                      <div className={`p-3 rounded-lg shadow ${isMine ? 'bg-[#005c4b] rounded-tr-none' : 'bg-[#202c33] rounded-tl-none'}`}>
                        <p className="text-sm break-words">{item.content}</p>
                        <p className="text-[10px] text-gray-400 mt-1 text-right">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={`file-${item.id}`} className={`flex flex-col max-w-[70%] ${isMine ? 'self-end' : 'self-start'}`}>
                       {!isMine && selectedContact.email === 'global' && <span className="text-[10px] text-gray-400 ml-1">{item.sender_email}</span>}
                      <div className={`bg-[#202c33] p-4 rounded-lg shadow border border-gray-700 flex flex-col gap-3 ${isMine ? 'bg-[#005c4b] rounded-tr-none' : 'bg-[#202c33] rounded-tl-none'}`}>
                        <div className="flex items-center gap-3">
                          <div className="text-blue-400">
                             <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>
                          </div>
                          <div>
                            <p className="font-bold text-sm text-blue-400">{item.file_name}</p>
                            <p className="text-[10px] text-gray-400">Encrypted Transfer</p>
                          </div>
                        </div>
                        
                        {isMine ? (
                          <div className="mt-2 text-xs text-green-300 flex items-center justify-end gap-1">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                             Encrypted & Sent
                          </div>
                        ) : requestingFileId === item.id ? (
                          <form onSubmit={(e) => handleDownloadFile(e, item.id)} className="flex items-center gap-2 mt-2">
                            <input 
                              type="text" 
                              placeholder="Enter OTP" 
                              value={otpInput}
                              onChange={(e) => setOtpInput(e.target.value)}
                              maxLength={6}
                              required
                              className="bg-[#2a3942] border border-gray-600 focus:outline-none text-center w-24 rounded p-1 text-sm text-white"
                            />
                            <button type="submit" className="bg-green-600 px-3 py-1 rounded text-xs font-bold hover:bg-green-700">Unlock</button>
                          </form>
                        ) : (
                          <button 
                            onClick={() => handleRequestOTP(item.id)}
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-xs font-bold mt-2 text-center w-full"
                          >
                            Request OTP to Download
                          </button>
                        )}
                        <p className={`text-[10px] mt-1 ${isMine ? 'text-green-200' : 'text-gray-500'} text-right`}>
                          {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                  );
                }
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="bg-[#202c33] p-4 flex items-center gap-4">
              <div 
                className="text-gray-400 hover:text-white cursor-pointer transition-colors"
                onClick={() => fileUploadInputRef.current?.click()}
                title="Send Encrypted File"
              >
                <svg className="w-6 h-6 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
              </div>
              <input type="file" ref={fileUploadInputRef} className="hidden" onChange={handleSendFile} />

              <form onSubmit={handleSendMessage} className="flex-1 flex gap-4">
                <input 
                  type="text" 
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="Type a message..." 
                  className="flex-1 bg-[#2a3942] text-white px-4 py-3 rounded-lg focus:outline-none placeholder-gray-400"
                />
                <button type="submit" className="bg-[#00a884] hover:bg-[#008f6f] text-white p-3 rounded-full flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}