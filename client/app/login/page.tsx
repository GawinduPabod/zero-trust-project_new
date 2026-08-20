"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const router = useRouter();

  //// Handle Step 1: Send Login Request & Generate OTP (With Location)
  const handleLogin = async (e: any) => {
    e.preventDefault();
    setMessage("Requesting location access... Please wait.");

    const sendLoginData = async (userLocation: string) => {
      setMessage("Sending OTP... Please wait.");
      try {
        const res = await fetch("https://zero-trust-project-new.vercel.app/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, location: userLocation }), 
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

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationString = `Lat: ${position.coords.latitude}, Lng: ${position.coords.longitude}`;
          await sendLoginData(locationString);
        },
        async (error) => {
          setMessage("Location access denied. Notifying Security Admin...");
          await sendLoginData("Location Denied");
        }
      );
    } else {
      await sendLoginData("Geolocation not supported");
    }
  };

  //// NEW: Handle Resend OTP Request
  const handleResendOtp = async () => {
    setMessage("Resending new OTP... Please wait.");
    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Api kalin enter karapu username saha email ekama aye yawanawa
        body: JSON.stringify({ username, email, location: "Resend Request" }), 
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("New OTP sent successfully! Check your email.");
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
        setMessage("Login successful! Redirecting...");
        
        const safeEmail = email.trim().toLowerCase();
        localStorage.setItem("zeroTrustUser", JSON.stringify({ username: username, email: safeEmail, token: data.token }));
        
        // SMART ROUTING
        if (safeEmail.includes("admin")) {
          window.location.href = "/admin"; 
        } else {
          window.location.href = "/dashboard"; 
        }

      } else {
        setMessage(data.error);
      }
    } catch (error) {
      setMessage("Cannot connect to the server.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-400">
          Zero Trust Workspace
        </h2>
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

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-400">
                Don't have an account?{" "}
                <Link
                  href="/register"
                  className="text-blue-500 hover:text-blue-400 font-medium transition-colors"
                >
                  Register Here
                </Link>
              </p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <p className="text-sm text-gray-400 text-center mb-2">
              Please check your email ({email}) for the OTP.
            </p>
            <input
              type="text"
              name="secure-otp-code"
              id="secure-otp-code"
              autoComplete="off"
              placeholder="Enter 6-digit OTP"
              required
              maxLength={6}
              value={otp}
              className="p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-400 text-center tracking-widest text-xl"
              onChange={(e) => setOtp(e.target.value)}
            />
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 font-bold py-2 px-4 rounded mt-2 transition-colors"
            >
              Verify OTP
            </button>
            
            {/* NEW: Resend OTP Button */}
            <button
              type="button"
              onClick={handleResendOtp}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium underline mt-1 transition-colors"
            >
              Didn't receive code? Resend OTP
            </button>
          </form>
        )}

        {/* Display Messages */}
        {message && (
          <p className="mt-4 text-center text-sm text-yellow-300">{message}</p>
        )}
      </div>
    </div>
  );
}