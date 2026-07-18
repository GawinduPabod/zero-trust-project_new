"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1); 
  const [message, setMessage] = useState("");
  const router = useRouter();

  //// Handle Step 1: Send Login Request & Generate OTP
  const handleLogin = async (e: any) => {
    e.preventDefault();
    setMessage("Sending OTP... Please wait.");

    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setOtp(""); 
        setStep(2); 
      } else {
        setMessage(data.error);
      }
    } catch (error) {
      setMessage("Cannot connect to the server.");
    }
  };

  //// Handle Step 2: Verify OTP and Redirect
  const handleVerifyOtp = async (e: any) => {
    e.preventDefault();
    setMessage("Verifying OTP...");

    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        
        // අත්‍යවශ්‍ය පියවර: පරිශීලක දත්ත Browser හි සුරැකීම
        localStorage.setItem("zeroTrustUser", JSON.stringify(data.user)); 
        
        // Forcefully redirecting to the dashboard
        setTimeout(() => {
          window.location.href = "/dashboard"; 
        }, 1000);
      } else {
        setMessage(data.error);
      }
    } catch (error) {
      setMessage("Cannot connect to the server.");
    }
  };

  //// UI Section
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-400">Zero Trust Workspace</h2>
        <h3 className="text-lg mb-4 text-center">Login</h3>

        {step === 1 ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Username"
              required
              className="p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-400"
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="email"
              placeholder="Email Address"
              required
              className="p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-400"
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 font-bold py-2 px-4 rounded mt-4 transition-colors"
            >
              Send OTP
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <p className="text-sm text-gray-400 text-center mb-2">
              Please check your email ({email}) for the OTP.
            </p>
            
            {/* Auto-fill prevention handled here */}
            <input
              type="text"
              name="secure-otp-code"
              id="secure-otp-code"
              autoComplete="off"
              placeholder="Enter 6-digit OTP"
              required
              maxLength={6}
              value={otp}
              className="p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-400 text-center tracking-widest text-xl font-bold"
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 font-bold py-2 px-4 rounded mt-2 transition-colors" 
            >
              Verify & Login
            </button>
            
            <button
              type="button"
              onClick={handleLogin}
              className="text-sm text-blue-400 hover:text-blue-300 mt-2 text-center underline"
            >
              Didn't receive code? Resend OTP
            </button>
          </form>
        )}

        {message && (
          <p className={`mt-4 text-center text-sm ${message.includes("successful") ? "text-green-400" : "text-yellow-300"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}