import { GoogleGenAI } from "@google/genai";
import base64js from 'base64-js';

export async function getGeminiFitnessPlan({ imageFile, height, weight }: { imageFile: File; height: number; weight: number }): Promise<string> {
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

  // Compose a rich, explicit prompt for Gemini
  const prompt = `You are a health and fitness expert. Given the following user data:
Height: ${height} cm
Weight: ${weight} kg

Analyze the attached full-body image and provide a detailed, structured response in the following format:

BMI: <number>
Body Fat Percentage: <number>
Muscle Mass Percentage: <number>
Body Composition: <short description>
Summary: <one-liner summary>
Plans:
- Title: <plan name>
  Exercise: <details>
  Diet: <details>
  Sleep: <details>
  Avoid: <details>
- Title: <plan name>
  Exercise: <details>
  Diet: <details>
  Sleep: <details>
  Avoid: <details>

Respond with all fields filled and avoid leaving any field blank. If you cannot infer a value, provide your best estimate or say "Not available".`;

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
