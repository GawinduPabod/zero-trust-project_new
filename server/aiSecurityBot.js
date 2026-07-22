const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// Initialize Gemini AI with the API Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate a detailed security report when an attack is detected
 * @param {string} attackType - The type of attack (e.g., "Brute Force", "SQL Injection")
 * @param {string} ipAddress - The attacker's IP address
 * @param {string} targetEmail - The email being targeted (if any)
 */
async function generateSecurityReport(attackType, ipAddress, targetEmail = "Unknown") {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `
            You are the "Security Admin (AI)" for a highly secure system named 'Zero Trust Workspace'.
            An active cyber attack has just been intercepted by the system firewall.
            
            Attack Details:
            - Attack Type: ${attackType}
            - Attacker IP Address: ${ipAddress}
            - Targeted Account: ${targetEmail}
            - System Response: Connection Terminated & IP Blocked
            
            Write a short, highly professional, and urgent security alert message to the Human System Administrator. 
            Do not include any pleasantries. Be direct and state that the threat was successfully neutralized by the Zero Trust Architecture.
        `;
        
        const result = await model.generateContent(prompt);
        return result.response.text();
        
    } catch (error) {
        console.error("AI Bot Generation Error:", error);
        return `🚨 AUTOMATED ALERT: A ${attackType} attempt was detected from IP ${ipAddress}. The AI analysis module is currently offline, but the threat was blocked.`;
    }
}

// Export the function to be used in other files
module.exports = { generateSecurityReport };