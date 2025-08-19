import { GoogleGenAI } from "@google/genai";
import base64js from 'base64-js';

export async function getGeminiFitnessPlan({ imageFile, height, weight }: { imageFile: File; height: number; weight: number }): Promise<string> {
  // Validate inputs
  if (!imageFile) {
    throw new Error("Image file is required");
  }
  if (!height || !weight || height <= 0 || weight <= 0) {
    throw new Error("Valid height and weight are required");
  }
  
  const imageBase64: string = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      resolve(base64js.fromByteArray(bytes));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(imageFile);
  });

  // Compose a comprehensive prompt for maximum health insights
  const prompt = `You are an advanced health and fitness AI expert. Analyze the provided image and user data to extract comprehensive health insights.

User Data:
- Height: ${Number(height)} cm
- Weight: ${Number(weight)} kg

CRITICAL INSTRUCTION: You must respond with ONLY a valid JSON object. Do NOT use markdown code blocks. Do NOT include any text before or after the JSON. Start your response directly with { and end with }. The response must be parseable by JSON.parse().

Required JSON structure:

{
  "basicMetrics": {
    "bmi": <number>,
    "bmiCategory": "<underweight/normal/overweight/obese>",
    "bodyFatPercentage": <number>,
    "muscleMassPercentage": <number>,
    "visceralFatLevel": <1-12>,
    "metabolicAge": <number>
  },
  "bodyAnalysis": {
    "overallPosture": "<description>",
    "bodyShape": "<pear/apple/rectangle/hourglass/inverted triangle>",
    "muscleDefinition": "<poor/fair/good/excellent>",
    "bodyComposition": "<detailed analysis>",
    "proportions": {
      "shoulderToWaist": "<description>",
      "waistToHip": "<description>"
    }
  },
  "healthRisks": {
    "cardiovascular": "<low/moderate/high>",
    "diabetes": "<low/moderate/high>",
    "jointHealth": "<good/fair/poor>",
    "recommendations": ["<risk1>", "<risk2>"]
  },
  "fitnessLevel": {
    "estimated": "<beginner/intermediate/advanced>",
    "strengthIndicators": "<description>",
    "flexibilityIndicators": "<description>",
    "enduranceIndicators": "<description>"
  },
  "personalizedPlans": [
    {
      "planType": "Weight Loss" | "Muscle Building" | "General Fitness" | "Health Improvement",
      "priority": "high" | "medium" | "low",
      "duration": "<timeframe>",
      "exercise": {
        "cardio": "<detailed recommendations>",
        "strength": "<detailed recommendations>",
        "flexibility": "<detailed recommendations>",
        "frequency": "<weekly schedule>"
      },
      "nutrition": {
        "calories": <daily calories>,
        "protein": "<grams and sources>",
        "carbs": "<recommendations>",
        "fats": "<recommendations>",
        "hydration": "<water intake>",
        "supplements": ["<supplement1>", "<supplement2>"]
      },
      "lifestyle": {
        "sleep": "<hours and quality tips>",
        "stress": "<management techniques>",
        "recovery": "<rest day recommendations>"
      },
      "avoid": ["<item1>", "<item2>", "<item3>"]
    }
  ],
  "progressTracking": {
    "keyMetrics": ["<metric1>", "<metric2>", "<metric3>"],
    "measurementFrequency": "<daily/weekly/monthly>",
    "expectedResults": {
      "week4": "<description>",
      "week8": "<description>",
      "week12": "<description>"
    }
  },
  "summary": "<comprehensive overview>"
}

Analysis Guidelines:
- Use image analysis for posture, body shape, muscle definition
- Calculate BMI from height/weight
- Estimate body fat % visually (ranges: Male 6-24%, Female 16-30%)
- Provide realistic muscle mass estimates
- Give 2-3 personalized plans based on apparent needs
- Include specific, actionable recommendations
- Use numbers only (no % symbols in numeric fields)
- If any metric cannot be determined, use reasonable estimates based on visible factors`;

  const contents: { role: string; parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> }[] = [
    {
      role: 'user',
      parts: [
        { inlineData: { mimeType: imageFile.type, data: imageBase64 } },
        { text: prompt }
      ]
    }
  ];

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not set in environment variables.");
  const ai = new GoogleGenAI({ apiKey });
  const stream = await ai.models.generateContentStream({
    model: "gemini-2.0-flash",
    contents,
  });

  const buffer: string[] = [];
  for await (const response of stream) {
    if (response.text) buffer.push(response.text);
  }
  return buffer.join('');
}
