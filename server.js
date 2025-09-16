// Import necessary packages
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const fetch = require("node-fetch");
require("dotenv").config(); // Loads environment variables from a .env file

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- REQUEST LOGGER ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- CONFIGURATION ---
const {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_DATABASE,
  JWT_SECRET,
  GEMINI_API_KEY, // Securely loaded from .env file
  PORT = 5000,
} = process.env;

const SALT_ROUNDS = 10;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

// --- DATABASE CONNECTION POOL ---
// A connection pool is more efficient and scalable for web servers.
const db = mysql
  .createPool({
    connectionLimit: 10, // Max number of connections
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
  })
  .promise(); // Use .promise() to enable async/await for queries

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  });
};

// --- PAGE ROUTES ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "login.html"))
);

// --- API ROUTES ---

// Add these routes before "// --- START SERVER ---"

// Health Check Route
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    server: "idea2prompt",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: ["/api/register", "/api/login"],
      prompts: ["/api/generate-prompt", "/api/prompts", "/api/prompts/:id"],
      test: ["/api/test-gemini", "/api/health"]
    }
  });
});

// Test Gemini API Route
app.get("/api/test-gemini", async (req, res) => {
  try {
    console.log("🧪 Testing Gemini API connection...");
    
    const testPrompt = "What is artificial intelligence?";
    const requestBody = {
      contents: [{ parts: [{ text: testPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 512,
      },
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Gemini API Test Error:", errorText);
      throw new Error(`Gemini API request failed: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!generatedText) {
      throw new Error("No valid response generated from Gemini API");
    }

    console.log("✅ Gemini API test successful!");
    
    res.json({
      success: true,
      message: "Gemini API connection successful",
      testPrompt,
      response: generatedText,
      usage: data.usageMetadata || "Usage data not available",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Gemini API Test Failed:", error.message);
    res.status(500).json({
      success: false,
      error: "Gemini API test failed",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// User Registration
app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "All fields are required" });

  try {
    const checkUserQuery =
      "SELECT id FROM registered_users WHERE email = ? OR username = ?";
    const [existingUsers] = await db.query(checkUserQuery, [email, username]);

    if (existingUsers.length > 0) {
      return res
        .status(400)
        .json({ error: "Email or username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const insertUserQuery =
      "INSERT INTO registered_users (username, email, password_hash) VALUES (?, ?, ?)";
    const [result] = await db.query(insertUserQuery, [
      username,
      email,
      passwordHash,
    ]);

    const token = jwt.sign(
      { userId: result.insertId, username },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.status(201).json({
      message: "User registered successfully",
      token,
      user: { id: result.insertId, username, email },
    });
  } catch (error) {
    console.error("❌ Registration Error:", error);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// User Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });

  try {
    const query = "SELECT * FROM registered_users WHERE email = ?";
    const [results] = await db.query(query, [email]);

    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = results[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    // Log the login attempt (can be done in the background, no need to await)
    const logQuery =
      "INSERT INTO login_history (user_id, success) VALUES (?, ?)";
    db.query(logQuery, [user.id, validPassword]).catch((logErr) =>
      console.error("⚠️ Failed to log login attempt:", logErr)
    );

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// --- Gemini API Function ---
async function generateAIPrompt(idea, category) {
  const metaPrompt = `
You are an expert prompt engineer. Your task is to generate a clear, detailed, and actionable AI prompt based on the user's input.

Category: "${category}"
User's Idea: "${idea}"

Create a comprehensive prompt that an AI assistant can use to provide the best possible response. The prompt should be specific and well-structured.

Generated Prompt:`;

  try {
    const requestBody = {
      contents: [{ parts: [{ text: metaPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Gemini API Error Response:", errorText);
      throw new Error(`Gemini API request failed: ${response.status}`);
    }

    const data = await response.json();
    const generatedText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!generatedText) {
      console.error("Empty response from Gemini:", data);
      throw new Error("No valid response generated from Gemini API");
    }

    return generatedText;
  } catch (error) {
    console.error("❌ Error in generateAIPrompt:", error.message);
    throw error; // Re-throw the error to be caught by the route handler
  }
}

// Generate Prompt API Route (Protected)
app.post("/api/generate-prompt", authenticateToken, async (req, res) => {
  const { idea, category } = req.body;
  const { userId } = req.user;

  if (!idea || idea.trim().length === 0) {
    return res
      .status(400)
      .json({ error: "Idea is required and cannot be empty" });
  }

  try {
    const generatedPrompt = await generateAIPrompt(
      idea.trim(),
      category || "General"
    );

    const query =
      "INSERT INTO prompts (user_id, category, idea, generated_prompt) VALUES (?, ?, ?, ?)";
    const [result] = await db.query(query, [
      userId,
      category || "General",
      idea.trim(),
      generatedPrompt,
    ]);

    res.json({
      success: true,
      id: result.insertId,
      prompt: generatedPrompt,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate prompt",
      details: error.message,
    });
  }
});

// Get User Prompts API Route (Protected)
app.get("/api/prompts", authenticateToken, async (req, res) => {
  try {
    const query =
      "SELECT * FROM prompts WHERE user_id = ? ORDER BY created_at DESC";
    const [results] = await db.query(query, [req.user.userId]);
    res.json(results);
  } catch (error) {
    console.error("❌ Fetch Prompts Error:", error);
    res.status(500).json({ error: "Failed to fetch prompts" });
  }
});

// Delete Prompt API Route (Protected)
app.delete("/api/prompts/:id", authenticateToken, async (req, res) => {
  try {
    const query = "DELETE FROM prompts WHERE id = ? AND user_id = ?";
    const [result] = await db.query(query, [req.params.id, req.user.userId]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "Prompt not found or user not authorized" });
    }
    res.json({ message: "Prompt deleted successfully" });
  } catch (error) {
    console.error("❌ Delete Prompt Error:", error);
    res.status(500).json({ error: "Failed to delete prompt" });
  }
});

// --- ERROR HANDLING MIDDLEWARE ---
app.use((err, req, res, next) => {
  console.error("❌ Unhandled Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// --- 404 HANDLER ---
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    message: `${req.method} ${req.url} is not a valid endpoint`,
    availableEndpoints: {
      pages: ["/", "/login"],
      api: [
        "GET /api/health",
        "GET /api/test-gemini", 
        "POST /api/register",
        "POST /api/login",
        "POST /api/generate-prompt",
        "GET /api/prompts",
        "DELETE /api/prompts/:id"
      ]
    }
  });
});

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Gemini test: http://localhost:${PORT}/api/test-gemini`);
  
  // Security Check: Verify that the API key is loaded from the environment
  if (!GEMINI_API_KEY) {
    console.error("❌ FATAL ERROR: GEMINI_API_KEY is not set in .env file.");
    process.exit(1);
  } else {
    console.log("✅ Gemini API Key configured.");
  }

  // Database connection check
  db.query('SELECT 1')
    .then(() => console.log("✅ Database connection successful."))
    .catch(err => console.error("❌ Database connection failed:", err.message));
});