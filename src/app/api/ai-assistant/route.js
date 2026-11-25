import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseconfig";

// Initialize Gemini Client if GEMINI_API_KEY is available
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiClient = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// Initialize OpenAI Client if OPENAI_API_KEY is available
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

const WORKGRID_AI_SYSTEM_INSTRUCTION = `
You are WorkGrid AI, an intelligent, friendly, and professional AI assistant integrated into a project management application.

Your primary goal is to communicate with users naturally, just like an experienced human assistant.

### Communication Rules
1. Always understand the user's actual intention before responding.
2. Use simple, natural, human-friendly language.
3. Be professional, friendly, clear, and conversational.
4. Avoid robotic, repetitive, or overly formal responses.
5. Keep answers concise and relevant to the user's question.
6. Do not provide unnecessary explanations or information.
7. Never generate long responses when a short answer is sufficient.
8. Avoid repeating the user's question in your response.
9. Do not provide multiple examples or templates unless requested.
10. Do not use unnecessary headings, bullet points, or numbered lists.
11. Answer directly instead of explaining what you are going to do.
12. Do not make up information or pretend to know something you do not know.

### Understanding User Intent
- Understand what the user wants, even if their English contains grammatical mistakes, spelling mistakes, or incomplete sentences.
- If a request is broad (e.g. "Write a professional email"), ask a natural follow-up instead of dumping generic templates: "Sure! Who is the email for, and what would you like to communicate?"
- If essential information is missing, ask only the single most important follow-up question. Do not ask multiple unnecessary questions.

### Response Style
- For simple questions, give simple answers.
- For technical questions, explain step by step when necessary.
- For writing requests, provide ready-to-use content directly.
- For greetings, respond naturally and briefly.
- For project-related questions, use professional project management language.
- For unclear requests, ask for clarification politely.
- For follow-up questions, maintain the conversation context.

### Email Writing Rules
When users request an email:
- Generate a professional and natural email.
- Include a relevant subject line when appropriate.
- Use clear and simple sentences.
- Avoid unnecessary formal language.
- Never provide multiple templates unless requested.
- Do not invent recipient names, dates, or project details.
- Use placeholders only when necessary.

### Important Final Rule
Always prioritize understanding, clarity, relevance, and natural human conversation over long AI-generated responses. Your responses should feel like they come from a knowledgeable human assistant, not a generic chatbot.
`;

export async function POST(request) {
  try {
    // 1. Verify user authentication session if token cookie or auth header is present
    let authToken = null;
    try {
      if (request.cookies && typeof request.cookies.get === "function") {
        authToken = request.cookies.get("token")?.value;
      }
      if (!authToken && request.headers && typeof request.headers.get === "function") {
        authToken = request.headers.get("authorization")?.replace("Bearer ", "");
      }
    } catch (_) {
      // safe fallback if cookie parsing is unsupported
    }

    let authenticatedUser = null;
    if (authToken && supabase?.auth?.getUser) {
      try {
        const authResponse = await supabase.auth.getUser(authToken);
        if (authResponse && !authResponse.error && authResponse.data?.user) {
          authenticatedUser = authResponse.data.user;
        }
      } catch (authErr) {
        console.warn("Could not verify supabase user session:", authErr?.message);
      }
    }

    // 2. Validate incoming request body
    let body = {};
    try {
      body = await request.json();
    } catch (parseErr) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    // Sanitize and format messages
    const formattedMessages = messages
      .filter((msg) => msg && typeof msg.content === "string" && msg.content.trim())
      .map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content.trim(),
      }));

    if (formattedMessages.length === 0) {
      return NextResponse.json(
        { error: "Valid message content is required" },
        { status: 400 }
      );
    }

    let answer = "";

    // -------------------------------------------------------------
    // 3. PRIORITY 1: Google Gemini API via @google/genai
    // -------------------------------------------------------------
    if (geminiClient) {
      const preferredModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
      const candidateModels = [preferredModel, "gemini-3.5-flash", "gemini-3.1-flash-lite"];

      // Map conversation history to Gemini multi-turn format:
      // role: 'user' | 'model'
      const contents = formattedMessages.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

      let lastGeminiError = null;

      for (const modelName of candidateModels) {
        try {
          const res = await geminiClient.models.generateContent({
            model: modelName,
            config: {
              systemInstruction: WORKGRID_AI_SYSTEM_INSTRUCTION,
            },
            contents: contents,
          });

          if (res && res.text) {
            answer = res.text.trim();
            break; // Successfully generated response
          }
        } catch (geminiErr) {
          console.warn(`Gemini model ${modelName} issue:`, geminiErr?.message || geminiErr);
          lastGeminiError = geminiErr;
        }
      }

      if (!answer && lastGeminiError) {
        throw lastGeminiError;
      }
    }
    // -------------------------------------------------------------
    // 4. PRIORITY 2: OpenAI API (if configured and Gemini is not active)
    // -------------------------------------------------------------
    else if (openaiClient) {
      const response = await openaiClient.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: WORKGRID_AI_SYSTEM_INSTRUCTION,
          },
          ...formattedMessages,
        ],
      });

      answer = response.choices?.[0]?.message?.content || "";
    } else {
      return NextResponse.json(
        { error: "No AI provider configured. Please set GEMINI_API_KEY in .env." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      answer: answer || "I processed your request, but received an empty response.",
      user: authenticatedUser ? { id: authenticatedUser.id, email: authenticatedUser.email } : null,
    });

  } catch (error) {
    console.error("AI Assistant API Error:", error);

    const errorMessage =
      error?.status === 401 || error?.message?.includes("API_KEY_INVALID")
        ? "Invalid AI API Key. Please verify your GEMINI_API_KEY in .env."
        : error?.message || "Unable to generate AI response";

    return NextResponse.json(
      { error: errorMessage },
      { status: error?.status || 500 }
    );
  }
}
