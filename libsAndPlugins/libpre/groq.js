const Groq = require("groq-sdk");

const API_KEY = process.env.GROQ_API_KEY || "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";

const client = new Groq({ apiKey: API_KEY });

async function ErrorMDChat(prompt) {
  try {
    const chatCompletion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are Error-MD AI assistant." },
        { role: "user", content: prompt },
      ],
      model: "llama-3.1-8b-instant",
    });
    return chatCompletion.choices[0].message.content;
  } catch (error) {
    console.error("Groq AI Error:", error);
    return "❌ AI is currently unavailable. Please try again later.";
  }
}

module.exports = { ErrorMDChat, PrexzyChat: ErrorMDChat };
