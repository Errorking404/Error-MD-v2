
#🚀 Error-MD | The Ultimate WhatsApp Bot

![Version](https://img.shields.io/badge/Version-3.0.0-blueviolet?style=for-the-badge)
![Node](https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Multi--Device-orange?style=for-the-badge)
![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=for-the-badge)

**Error-MD** is a high-performance, feature-rich WhatsApp Multi-Device bot designed for stability, speed, and total group control. From AI-powered conversations to global media downloading, Error-MD is your all-in-one companion for WhatsApp.

---

✨ Key Features

🧠 Advanced AI Intelligence
- **Powered by Groq AI:** Experience lightning-fast responses using the latest **Llama 3.1** models.
- **Smart Conversations:** Ask anything, get help with coding, or just chat with a highly capable AI.

📥 Global Media Downloader
Download high-quality content from across the web effortlessly:
- 📺 **YouTube:** Music (MP3) and Video (MP4) with search support.
- 🎵 **TikTok:** Download videos without watermarks.
- 📸 **Instagram:** Reels, Posts, and Stories.
- 💙 **Facebook:** High-quality video downloads.
- 📌 **Pinterest & 🐦 Twitter (X):** Integrated support for seamless downloads.

🛡️ Powerful Group Management
Take total control of your communities:
- **Admin Suite:** `.kick`, `.promote`, `.demote`, `.mute`, `.unmute`.
- **Engagement:** `.tagall`, `.hidetag` for instant notifications.
- **Security:**
    - **Anti-Link:** Automatically detect and remove unauthorized links.
    - **Anti-Badword:** Keep your groups clean with an automated moderation system.

🛠️ Utility & Magic Tools
- **🔍 View-Once Decryptor:** Use `.vv` to save and view "View Once" images and videos.
- **🖼️ Meme Maker:** Create custom memes on the fly.
- **📄 PDF Toolkit:** Convert images to professional PDF documents.
- **📊 System Stats:** Real-time bot performance and uptime monitoring.

---

🚀 Deployment & Hosting
**Termux only** - Optimized for Android/Termux 24/7 uptime.

🛠️ Termux Installation

1. **Update everything:**
   ```bash
   pkg update && pkg upgrade
```
2. *Install system dependencies:*
   # For fluent-ffmpeg →
```
   pkg install ffmpeg
```
   # For sharp →
```
   pkg install libvips
```
   # For node-tesseract-ocr →
```
   pkg install tesseract
```
   # For general build tools →
```
   pkg install build-essential python nodejs yarn pm2
```
3. *Clone the repository:*
```
   git clone https://github.com/your-username/Error-MD.git
   cd Error-MD
```
4. *Install dependencies:*
```
   yarn install
```
5. *Configure your environment:*
   Create a `.env` file and add your keys: (Its optional. You can skip this)
```
   GROQ_API_KEY=your_groq_key_here
   BOT_NAME=Error-MD
```
6. *Start the bot with PM2 for 24/7 uptime:*
  ```
  pm2 start s2.js --name error-md
  
   pm2 save
   pm2 startup
  ```

   *PM2 commands:* 
 `pm2 restart error-md`
 `pm2 logs error-md`
 `pm2 stop error-md`

---

📜 Command Overview
Category	Example Commands	Description
**AI**	`.groq <prompt>`, `.worm <model> <prompt>`	Chat with Llama 3.1 and wormgpt
**Download**	`.song <query>`, `.video`, `.tiktok`, `.insta`, `.fb`	Media from YT, TT, IG, FB
**Admin**	`.kick`, `.promote`, `.mute`, `.tagall`	Group management
**Security**	`.antilink on`, `.antibadword on`	Auto-moderation
**Tools**	`.vv`, `.meme`, `.pdf`	Utility and magic tools
**Info**	`.menu`, `.alive`, `.stats`	Bot information
---

🤝 Contributing
Contributions are welcome! Feel free to open an issue or submit a pull request to help make Error-MD even better.

📄 License
This project is licensed under the *GPL-3.0 License*.

---
*Created with ❤️ by * #Errorking404

