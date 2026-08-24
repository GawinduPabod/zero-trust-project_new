"use client";
import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleRegister = async (e: any) => {
    e.preventDefault();
    setMessage("Registering... Please wait.");
    setIsSuccess(false);

    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });

      const data = await res.json();
      if (res.ok) {
        // Oya illapu aluth message eka metana thiyenawa
        setMessage("Registration successful. Waiting for admin approval.");
        setIsSuccess(true);
      } else {
        setMessage(data.error || "Registration failed.");
        setIsSuccess(false);
      }
    } catch (error) {
      setMessage("Cannot connect to the server.");
      setIsSuccess(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-400">
          Zero Trust Workspace
        </h2>
        <h3 className="text-lg mb-4 text-center">Register</h3>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Username"
            required
            value={username}
            className="p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-400"
            onChange={(e) => setUsername(e.target.value)}
            disabled={isSuccess} // Register unata passe type karana eka disable wenawa
          />
          <input
            type="email"
            placeholder="Email Address"
            required
            value={email}
            className="p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-400"
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSuccess}
          />
          
          {/* Register unata passe Register button eka hangenawa */}
          {!isSuccess && (
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 font-bold py-2 px-4 rounded mt-2 transition-colors"
            >
              Register
            </button>
          )}

          {/* Success / Error Message Eka */}
          {message && (
            <p className={`mt-2 text-center text-sm font-medium ${isSuccess ? 'text-green-400' : 'text-yellow-300'}`}>
              {message}
            </p>
          )}

          {/* Login ekata yana link eka / button eka */}
          <div className="mt-4 text-center">
            {isSuccess ? (
              // Register success wunama ena loku 'Back to Login' button eka
              <Link href="/login">
                <button type="button" className="w-full bg-gray-600 hover:bg-gray-500 font-bold py-2 px-4 rounded mt-2 transition-colors">
                  Back to Login
                </button>
              </Link>
            ) : (
              // Normal welawata thiyena podi link eka
              <p className="text-sm text-gray-400">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-blue-500 hover:text-blue-400 font-medium transition-colors"
                >
                  Login Here
                </Link>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}