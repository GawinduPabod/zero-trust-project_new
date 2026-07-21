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

  //// Handle Step 1: Send Login Request & Generate OTP
  const handleLogin = async (e: any) => {
    e.preventDefault();
    setMessage("Sending OTP... Please wait.");

    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/api/login", {
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
      const res = await fetch("https://zero-trust-project-new.vercel.app/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Login successful! Redirecting...");
        localStorage.setItem("token", data.token);
        localStorage.setItem("userEmail", email);
        router.push("/dashboard");
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

            {/* Register Link */}
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
              className="p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-400 text-center tracking-widest text-xl"
              onChange={(e) => setOtp(e.target.value)}
            />
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 font-bold py-2 px-4 rounded mt-4 transition-colors"
            >
              Verify OTP
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