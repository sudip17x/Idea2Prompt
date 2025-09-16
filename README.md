# 🚀 Idea to Prompt Generator

A full-stack web application that converts user ideas into **AI-generated prompts** using **Google Gemini API**.
It includes **user authentication (JWT, bcrypt)**, a **frontend UI (HTML, TailwindCSS, JavaScript)**, and a **backend server (Node.js, Express.js, MySQL)**.

---

## ✨ Features

* 🔐 **User Authentication** (Sign Up, Login, Logout) with JWT & bcrypt
* 🎨 **Modern UI** using TailwindCSS
* 🧠 **AI Prompt Generation** powered by Gemini API
* 📋 **Copy to Clipboard** functionality for generated prompts
* ⚡ **Error Handling** for API failures and invalid inputs
* 🗂️ **Secure API routes** (token-based authentication)

---

## 🛠️ Tech Stack

### Frontend

* HTML, CSS, JavaScript
* TailwindCSS for responsive UI

### Backend

* Node.js, Express.js
* MySQL (User database)
* JWT for authentication
* bcrypt for password hashing
* Gemini API integration

---

## ⚙️ Setup Instructions

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/idea-to-prompt.git
cd idea-to-prompt
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Setup Environment Variables

Create a **.env** file in the root directory:

```env
PORT=5000
JWT_SECRET=your_jwt_secret
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=idea_to_prompt
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent
GEMINI_API_KEY=your_gemini_api_key
```

### 4️⃣ Setup Database

Run `database.sql` in MySQL:

```sql
CREATE DATABASE idea_to_prompt;
USE idea_to_prompt;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255)
);
```

### 5️⃣ Start the Server

```bash
node server.js
```

---

## 🔑 User Flow

1. **Sign Up** → Register with username, email, password.
2. **Login** → Authenticate & receive JWT token.
3. **Access App** → Enter idea & select category.
4. **Generate Prompt** → Gemini API returns AI-generated text.
5. **Copy Prompt** → Use the "Copy" button to reuse prompts.

---

## 🚀 Future Improvements

* Add user history of generated prompts
* Dark mode UI
* Export prompts to PDF/Word
* Deploy on Vercel + Render/Heroku

---

## 📜 License

This project is licensed under the **MIT License**.


## 📂 Project Structure

```
├── index.html          # Main app interface
├── loginpage.html      # Login & Sign Up page
├── server.js           # Backend server with API routes
├── database.sql        # MySQL schema for users
├── .env                # API keys and secrets
└── README.md           # Project documentation
```
