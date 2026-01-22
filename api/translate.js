import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(request, response) {
  // Enable CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    
    if (!API_KEY || API_KEY === "YOUR_KEY_HERE") {
      return response.status(500).json({
        error: "Missing API key",
        message: "Please set GEMINI_API_KEY in environment variables"
      });
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    if (request.method === 'GET') {
      return response.status(200).json({
        message: "Translation API is working!",
        timestamp: new Date().toISOString()
      });
    }

    if (request.method === 'POST') {
      const { text, targetLanguage } = request.body;
      
      if (!text || !targetLanguage) {
        return response.status(400).json({
          error: "Missing required fields",
          message: "Both 'text' and 'targetLanguage' are required"
        });
      }

      // Translation prompt
      const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translation without any explanations:
      
Text: "${text}"`;

      const result = await model.generateContent(prompt);
      const translation = result.response.text().trim();

      return response.status(200).json({
        original: text,
        translation: translation,
        targetLanguage: targetLanguage,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Translation error:', error);
    return response.status(500).json({
      error: "Translation failed",
      message: error.message
    });
  }
}