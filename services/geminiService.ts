import { GoogleGenAI } from "@google/genai";
import { Transaction } from '../types';

// Safe check for API key
const API_KEY = process.env.API_KEY || '';

export const analyzeTransactions = async (transactions: Transaction[]): Promise<string> => {
  if (!API_KEY) {
    return "API Key is missing. Cannot analyze data.";
  }

  if (transactions.length === 0) {
    return "No transactions to analyze.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    // Formatting data for the prompt
    const txString = transactions.map(t => 
      `- ${t.date}: ${t.amount} THB from ${t.sender} (${t.message})`
    ).join('\n');

    const prompt = `
      Analyze the following TrueMoney transaction list (Thai Baht).
      Provide a brief summary in Thai language.
      Include total income and highlight any suspicious or large transactions.
      Keep it short (under 50 words).
      
      Data:
      ${txString}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not generate analysis.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to analyze transactions due to an error.";
  }
};
