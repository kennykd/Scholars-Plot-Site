import { GoogleGenAI } from "@google/genai";

// This file serves as the main entry point for the Gemini module, initializing the Google GenAI client.
// Client gets the API key from the environment variable GEMINI_API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const geminiFlash = ai.models;
export default ai;