"use client";
import { useState } from "react";

export default function RegisterPage() {
  //// State Variables
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  //// Handle Form Submission
  const handleRegister = async (e: any) => {
    e.preventDefault();
    setMessage("Please wait...");

    try {
      const res = await fetch("https://zero-trust-project-new.vercel.app/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username,
          email: email,
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        setMessage(data.message);
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
        <h3 className="text-lg mb-4 text-center">Register</h3>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
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
            Register
          </button>
        </form>

        {/* Display Messages */}
        {message && (
          <p className="mt-4 text-center text-sm text-yellow-300">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}