import { GoogleGenAI } from "@google/genai";
import Place from "../models/Place.js";
import Faq from "../models/Faq.js";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are a professional Egyptian tour guide chatbot. Answer in simple Arabic or English depending on the user language. Your mission is to help tourists explore Egypt safely, culturally and enjoyably.`;

const PROVINCES_MAP = {
  minya: ["minya", "minia", "المنيا"],
  cairo: ["cairo", "aut", "قاهرة", "القاهرة"],
  giza: ["giza", "جيزة", "الجيزة"],
  luxor: ["luxor", "أقصر", "الأقصر"],
  aswan: ["aswan", "اسوان", "أسوان"],
  alexandria: ["alexandria", "alex", "اسكندرية", "الإسكندرية"],
  "red sea": ["red sea", "hurghada", "el gouna", "بحر احمر", "البحر الأحمر"],
  matrouh: ["matrouh", "marsa matrouh", "مطروح", "مرسى مطروح"],
};

const NO_DATA_MESSAGE = "معلش حصلت مشكلة مؤقتة، ممكن تعيد سؤالك بطريقة تانية؟";
const AI_ERROR_MESSAGE = "معلش حصلت مشكلة مؤقتة، ممكن تعيد سؤالك بطريقة تانية؟";
const MAX_RESPONSE_LENGTH = 1000;

/**
 * Extract province and category from user message
 */
function extractIntent(message) {
  const lowerMessage = message.toLowerCase();

  // Detect province
  let detectedProvince = null;
  for (const [province, aliases] of Object.entries(PROVINCES_MAP)) {
    if (aliases.some((alias) => lowerMessage.includes(alias))) {
      detectedProvince = province;
      break;
    }
  }

  // Detect category
  const categoryKeywords = {
    hotels: [
      "hotel",
      "hotels",
      "accommodation",
      "stay",
      "resort",
      "فندق",
      "فنادق",
    ],
    archaeological: [
      "archaeological",
      "monument",
      "temple",
      "history",
      "pyramid",
      "أثر",
      "آثار",
      "معبد",
    ],
    entertainment: ["entertainment", "fun", "park", "cinema", "mall", "ترفيه"],
    events: ["event", "events", "festival", "concert", "فعالية", "فعاليات"],
  };

  let detectedCategory = null;
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
      detectedCategory = category;
      break;
    }
  }

  return { province: detectedProvince, category: detectedCategory };
}

/**
 * Search MongoDB for relevant tourism data (Place)
 */
async function searchDatabase(intent) {
  try {
    const { province, category } = intent;
    const searchQuery = { isActive: true };

    if (category) searchQuery.type = category;

    let places = await Place.find(searchQuery)
      .populate("province", "name governorate slug")
      .select("name type description tags location province images rating slug")
      .limit(100)
      .lean();

    if (province && places.length > 0) {
      const filteredPlaces = places.filter((p) => {
        if (!p.province || !p.province.name) return false;
        const provinceName = p.province.name.toLowerCase();
        const aliases = PROVINCES_MAP[province] || [];
        return (
          provinceName.includes(province) ||
          aliases.some((alias) => provinceName.includes(alias))
        );
      });
      places = filteredPlaces;
    }

    return places.slice(0, 5);
  } catch (error) {
    console.error("[aiChatService] Database search error:", error);
    return [];
  }
}

/**
 * Format database results for AI context
 */
function formatDatabaseContext(results) {
  if (!results || results.length === 0) return "";
  return results
    .map((item, index) => {
      const provinceName = item.province?.name || "Unknown";
      return `${index + 1}. Name: ${
        item.name
      }\n   Province: ${provinceName}\n   Type: ${
        item.type
      }\n   Description: ${item.description.substring(0, 150)}...`;
    })
    .join("\n\n");
}

/**
 * Call Gemini API with context using @google/genai
 */
export async function callGemini(userMessage, context = "") {
  try {
    const prompt = `${SYSTEM_PROMPT}\n\nDATA CONTEXT (if any):\n${context}\n\nUSER QUESTION: ${userMessage}`;
    const response = await client.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });
    
    // Extract text from the new SDK response structure
    if (
      response.candidates &&
      response.candidates[0] &&
      response.candidates[0].content &&
      response.candidates[0].content.parts &&
      response.candidates[0].content.parts.length > 0
    ) {
      return response.candidates[0].content.parts[0].text;
    }
    return null;
  } catch (error) {
    console.error("[aiChatService] Gemini API error:", error);
    return null;
  }
}

/**
 * Main chat function - Hybrid Mode
 * @param {string} userMessage - User's input message
 * @param {Array} history - Chat history
 * @returns {Promise<Object>} - { success, source, reply }
 */
export async function processAIChat(userMessage, history = []) {
  try {
    // 1. Validate input
    if (
      !userMessage ||
      typeof userMessage !== "string" ||
      !userMessage.trim()
    ) {
      return {
        success: false,
        source: "database",
        reply: "Please provide a valid question.",
      };
    }
    const sanitizedMessage = userMessage.trim();

    // 2. Search FAQ (Database First)
    const regex = new RegExp(
      sanitizedMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );

    // Attempt exact match or regex substring match on Question
    const faqMatch = await Faq.findOne({
      question: { $regex: regex },
    });

    if (faqMatch) {
      console.log(`[aiChatService] FAQ Match found: ${faqMatch.question}`);
      return {
        success: true,
        source: "database",
        reply: faqMatch.answer,
      };
    }

    // 3. If no FAQ match, proceed to Gemini Flow (which includes Place DB search context)
    const intent = extractIntent(sanitizedMessage);
    let dbResults = [];
    if (intent.province || intent.category) {
      dbResults = await searchDatabase(intent);
    }

    const context = formatDatabaseContext(dbResults);

    // 4. Call Gemini (no history support in new SDK)
    const geminiResponse = await callGemini(sanitizedMessage, context);

    if (geminiResponse) {
      return {
        success: true,
        source: "gemini",
        reply: geminiResponse,
        data: dbResults.map((place) => ({
          id: place._id,
          name: place.name,
          type: place.type,
          location: place.location,
          province: place.province,
          description: place.description,
          slug: place.slug,
          images: place.images,
          rating: place.rating,
        })),
      };
    }

    // 5. Fallback if Gemini fails
    return {
      success: true,
      source: "gemini",
      reply: AI_ERROR_MESSAGE,
    };
  } catch (error) {
    console.error("[aiChatService] processAIChat error:", error);
    return {
      success: false,
      source: "database",
      reply: AI_ERROR_MESSAGE,
    };
  }
}

export default {
  processAIChat,
};
