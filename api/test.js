export default function handler(req, res) {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Handle GET request
  if (req.method === 'GET') {
    res.status(200).json({
      message: "API works!",
      timestamp: new Date().toISOString(),
      status: "success"
    });
    return;
  }
  
  // Handle POST request for translation
  if (req.method === 'POST') {
    try {
      const { text, targetLanguage } = req.body;
      
      if (!text || !targetLanguage) {
        res.status(400).json({
          error: "Missing required fields",
          message: "Both 'text' and 'targetLanguage' are required"
        });
        return;
      }
      
      // Simulate translation (في الحقيقة هنستخدم Gemini API)
      const translatedText = `[Translated to ${targetLanguage}]: ${text}`;
      
      res.status(200).json({
        original: text,
        translation: translatedText,
        targetLanguage: targetLanguage,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: "Translation failed",
        message: error.message
      });
    }
    return;
  }
  
  // Method not allowed
  res.status(405).json({
    error: "Method not allowed",
    message: `Method ${req.method} is not supported for this endpoint`
  });
}