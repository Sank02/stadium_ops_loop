import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { Signals } from './sense';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are the Reasoning stage of an autonomous Stadium Operations Loop for a FIFA World Cup
2026 venue. You do not talk to fans directly — you advise stadium staff by analyzing live
operational signals once per cycle.

## Your job
Given the current signal snapshot and a short history of your own recent recommendations,
decide whether any operational action is warranted right now. Most ticks may warrant NO
action — that is a valid and often correct output. Only recommend an action when the
signals genuinely indicate an emerging issue.

## Context you are given each cycle
- venue_layout: static facts about the stadium (gate names, concession stand IDs, known
  capacities). Never invent a location that isn't listed here.
- current_signals: gate queue lengths & wait times, concession wait times, weather, any
  volunteer-reported incidents.
- recent_history: your last 3 recommendations and their outcomes, so you don't repeat an
  action you already took or contradict yourself.

## Output format
Respond with ONLY a single JSON object, no prose before or after, matching this schema
exactly:

{
  "recommendation": string,
  "target_location": string | null,
  "confidence": number,
  "reasoning": string,
  "category": "crowd_management" | "navigation" | "accessibility" | "transportation" | "sustainability" | "safety" | "none",
  "alert_draft": { "en": string, "hi": string, "mr": string } | null,
  "requires_human_review": boolean
}

## Rules
1. Only reference target_location values that appear in venue_layout. If unsure, set
   target_location to null and requires_human_review to true.
2. Set confidence honestly — do not inflate it. If signals are ambiguous, or history shows
   a similar call was wrong recently, lower your confidence.
3. Set requires_human_review to true whenever confidence < 0.7, whenever the situation
   involves safety, or whenever you are extrapolating beyond what the signals directly show.
4. Do not repeat an identical recommendation you already made in recent_history unless the
   situation has measurably changed.
5. Keep alert_draft short (under 25 words per language), calm, and actionable for a fan
   reading it on a stadium screen.
6. If nothing warrants action, return recommendation: "no action needed", confidence
   reflecting your certainty in that assessment, and alert_draft: null.

Return valid JSON only. Do not include markdown code fences or any text outside the JSON
object.`;

export interface ReasoningOutput {
  recommendation: string;
  target_location: string | null;
  confidence: number;
  reasoning: string;
  category: "crowd_management" | "navigation" | "accessibility" | "transportation" | "sustainability" | "safety" | "none";
  alert_draft: { en: string; hi: string; mr: string } | null;
  requires_human_review: boolean;
}

export async function reason(signals: Signals, history: any[], venueLayout: any): Promise<ReasoningOutput> {
  const promptContent = `
VENUE LAYOUT:
${JSON.stringify(venueLayout, null, 2)}

CURRENT SIGNALS:
${JSON.stringify(signals, null, 2)}

RECENT HISTORY:
${JSON.stringify(history, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: promptContent,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.2,
      },
    });

    let jsonStr = response.text || "{}";
    // Clean up potential markdown code fences just in case, though prompted not to
    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(jsonStr) as ReasoningOutput;
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota')) {
      console.error("Quota exceeded (429) in Reason stage, skipping retry:", error.message);
      return {
        recommendation: "System error: rate limit exceeded.",
        target_location: null,
        confidence: 0,
        reasoning: "LLM API quota exceeded.",
        category: "none",
        alert_draft: null,
        requires_human_review: true,
      };
    }

    console.error("Error in Reason stage, retrying once:", error);
    // Single retry on malformed JSON or API error
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: promptContent,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.2,
        },
      });

      let jsonStr = response.text || "{}";
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr) as ReasoningOutput;
    } catch (retryError) {
      console.error("Retry failed in Reason stage:", retryError);
      return {
        recommendation: "System error: failed to generate valid recommendation.",
        target_location: null,
        confidence: 0,
        reasoning: "LLM API failed or returned unparseable JSON twice.",
        category: "none",
        alert_draft: null,
        requires_human_review: true,
      };
    }
  }
}
