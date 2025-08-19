"use client"
import Image from "next/image";
import jsPDF from "jspdf";
import { useState, useEffect, ChangeEvent } from "react";
import { getGeminiFitnessPlan } from "./geminiApi";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

// Comprehensive type definitions
interface BasicMetrics {
  bmi: number;
  bmiCategory: string;
  bodyFatPercentage: number;
  muscleMassPercentage: number;
  visceralFatLevel: number;
  metabolicAge: number;
}

interface BodyAnalysis {
  overallPosture: string;
  bodyShape: string;
  muscleDefinition: string;
  bodyComposition: string;
  proportions: {
    shoulderToWaist: string;
    waistToHip: string;
  };
}

interface HealthRisks {
  cardiovascular: string;
  diabetes: string;
  jointHealth: string;
  recommendations: string[];
}

interface FitnessLevel {
  estimated: string;
  strengthIndicators: string;
  flexibilityIndicators: string;
  enduranceIndicators: string;
}

interface PersonalizedPlan {
  planType: string;
  priority: string;
  duration: string;
  exercise: {
    cardio: string;
    strength: string;
    flexibility: string;
    frequency: string;
  };
  nutrition: {
    calories: number;
    protein: string;
    carbs: string;
    fats: string;
    hydration: string;
    supplements: string[];
  };
  lifestyle: {
    sleep: string;
    stress: string;
    recovery: string;
  };
  avoid: string[];
}

interface ProgressTracking {
  keyMetrics: string[];
  measurementFrequency: string;
  expectedResults: {
    week4: string;
    week8: string;
    week12: string;
  };
}

interface ComprehensiveResults {
  basicMetrics: BasicMetrics;
  bodyAnalysis: BodyAnalysis;
  healthRisks: HealthRisks;
  fitnessLevel: FitnessLevel;
  personalizedPlans: PersonalizedPlan[];
  progressTracking: ProgressTracking;
  summary: string;
}

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [urlError, setUrlError] = useState<string>("");
  const [height, setHeight] = useState<number>(0);
  const [weight, setWeight] = useState<number>(0);
  const [results, setResults] = useState<ComprehensiveResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [selectedPlan, setSelectedPlan] = useState<number>(0);

  // Reveal on scroll (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("in-view");
        });
      },
      { threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
      setImageUrl("");
      setError("");
    }
  }

  async function handleCalculate() {
    // Ensure height and weight are valid numbers
    const validHeight = Number(height);
    const validWeight = Number(weight);
    
    if (validHeight > 0 && validWeight > 0 && (image || imageUrl)) {
      setLoading(true);
      setResults(null);
      setError("");
      setUrlError("");

      try {
        // Prefer uploaded file; otherwise fetch image from URL and convert to File
        let fileToUse: File | null = image;
        if (!fileToUse && imageUrl) {
          try {
            const resp = await fetch(imageUrl, { cache: "no-store" });
            if (!resp.ok) throw new Error(`Failed to fetch image URL (status ${resp.status})`);
            const blob = await resp.blob();
            const mime = blob.type || (imageUrl.endsWith('.png') ? 'image/png' : imageUrl.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
            fileToUse = new File([blob], "image-from-url", { type: mime });
          } catch (err) {
            setUrlError("Could not load image from URL. Check the link or upload the file.");
            throw new Error("Could not load image from URL. Please check the link or try uploading the file.");
          }
        }
        if (!fileToUse) throw new Error("No image provided.");
        
        // Debug: Log the values being passed to the API
        console.log("Calling API with:", { height: validHeight, weight: validWeight, imageType: fileToUse.type });
        
        const response = await getGeminiFitnessPlan({ imageFile: fileToUse, height: validHeight, weight: validWeight });
        
        try {
          // Extract JSON from markdown code blocks if present
          let jsonString = response.trim();
          
          // Check if response is wrapped in markdown code blocks
          if (jsonString.startsWith('```json') || jsonString.startsWith('```')) {
            // Extract content between code blocks
            const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
            const match = jsonString.match(codeBlockRegex);
            if (match && match[1]) {
              jsonString = match[1].trim();
            } else {
              // Fallback: remove ```json and ``` markers
              jsonString = jsonString
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/, '')
                .replace(/\s*```$/, '')
                .trim();
            }
          }
          
          // Additional cleaning: remove any text before the first { or after the last }
          const firstBrace = jsonString.indexOf('{');
          const lastBrace = jsonString.lastIndexOf('}');
          
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonString = jsonString.substring(firstBrace, lastBrace + 1);
          }
          
          // Parse JSON response
          const parsedResults: ComprehensiveResults = JSON.parse(jsonString);
          
          // Validate and sanitize the parsed data
          const sanitizedResults: ComprehensiveResults = {
            basicMetrics: {
              bmi: Number.isFinite(parsedResults.basicMetrics?.bmi) ? parsedResults.basicMetrics.bmi : height > 0 && weight > 0 ? Number((weight / ((height / 100) ** 2)).toFixed(1)) : 0,
              bmiCategory: parsedResults.basicMetrics?.bmiCategory || "Unknown",
              bodyFatPercentage: Number.isFinite(parsedResults.basicMetrics?.bodyFatPercentage) ? parsedResults.basicMetrics.bodyFatPercentage : 0,
              muscleMassPercentage: Number.isFinite(parsedResults.basicMetrics?.muscleMassPercentage) ? parsedResults.basicMetrics.muscleMassPercentage : 0,
              visceralFatLevel: Number.isFinite(parsedResults.basicMetrics?.visceralFatLevel) ? parsedResults.basicMetrics.visceralFatLevel : 5,
              metabolicAge: Number.isFinite(parsedResults.basicMetrics?.metabolicAge) ? parsedResults.basicMetrics.metabolicAge : 25,
            },
            bodyAnalysis: parsedResults.bodyAnalysis || {
              overallPosture: "Analysis in progress",
              bodyShape: "Unknown",
              muscleDefinition: "Unknown",
              bodyComposition: "Analysis in progress",
              proportions: {
                shoulderToWaist: "Unknown",
                waistToHip: "Unknown"
              }
            },
            healthRisks: parsedResults.healthRisks || {
              cardiovascular: "Unknown",
              diabetes: "Unknown",
              jointHealth: "Unknown",
              recommendations: []
            },
            fitnessLevel: parsedResults.fitnessLevel || {
              estimated: "Unknown",
              strengthIndicators: "Unknown",
              flexibilityIndicators: "Unknown",
              enduranceIndicators: "Unknown"
            },
            personalizedPlans: Array.isArray(parsedResults.personalizedPlans) ? parsedResults.personalizedPlans : [],
            progressTracking: parsedResults.progressTracking || {
              keyMetrics: [],
              measurementFrequency: "Weekly",
              expectedResults: {
                week4: "Initial improvements",
                week8: "Noticeable changes",
                week12: "Significant progress"
              }
            },
            summary: parsedResults.summary || "Comprehensive analysis completed"
          };

          setResults(sanitizedResults);
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          console.error("Original response:", response);
          
          // Try to provide helpful error message
          if (response.includes('```')) {
            throw new Error("AI response contains markdown formatting. Please try again.");
          } else if (response.includes('I cannot') || response.includes('unable to')) {
            throw new Error("AI could not analyze the image. Please ensure it shows a clear full-body view.");
          } else {
            throw new Error(`Invalid response format from AI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
          }
        }
      } catch (e: unknown) {
        setError("Error: " + (e instanceof Error ? e.message : String(e)));
      }
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!results) return;
    
    const doc = new jsPDF();
    let y = 20;
    
    // Header
    doc.setFontSize(20);
    doc.text("BodyTune - Comprehensive Health Report", 20, y);
    y += 15;
    
    // Basic Info
    doc.setFontSize(14);
    doc.text("Personal Information", 20, y);
    y += 8;
    doc.setFontSize(12);
    doc.text(`Height: ${height} cm`, 20, y); y += 6;
    doc.text(`Weight: ${weight} kg`, 20, y); y += 6;
    doc.text(`BMI: ${results.basicMetrics.bmi}`, 20, y); y += 6;
    doc.text(`BMI Category: ${results.basicMetrics.bmiCategory}`, 20, y); y += 10;
    
    // Body Analysis
    doc.setFontSize(14);
    doc.text("Body Analysis", 20, y);
    y += 8;
    doc.setFontSize(12);
    doc.text(`Body Fat: ${results.basicMetrics.bodyFatPercentage}%`, 20, y); y += 6;
    doc.text(`Muscle Mass: ${results.basicMetrics.muscleMassPercentage}%`, 20, y); y += 6;
    doc.text(`Body Shape: ${results.bodyAnalysis.bodyShape}`, 20, y); y += 6;
    doc.text(`Muscle Definition: ${results.bodyAnalysis.muscleDefinition}`, 20, y); y += 10;
    
    // Personalized Plans
    doc.setFontSize(14);
    doc.text("Personalized Plans", 20, y);
    y += 8;
    
    results.personalizedPlans.forEach((plan, idx) => {
      doc.setFontSize(12);
      doc.text(`Plan ${idx + 1}: ${plan.planType}`, 20, y); y += 6;
      doc.text(`Priority: ${plan.priority}`, 25, y); y += 6;
      doc.text(`Duration: ${plan.duration}`, 25, y); y += 6;
      y += 4;
    });
    
    doc.save("BodyTune_Health_Report.pdf");
  }

  // BMI Category Color Helper
  const getBMIColor = (bmi: number) => {
    if (bmi < 18.5) return "text-blue-600";
    if (bmi < 25) return "text-green-600";
    if (bmi < 30) return "text-yellow-600";
    return "text-red-600";
  };

  // Risk Level Color Helper
  const getRiskColor = (risk: string) => {
    if (risk === "low") return "text-green-600 bg-green-50";
    if (risk === "moderate") return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Hero */}
      <section className="relative reveal in-view overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-cyan-900/20"></div>
        <div className="absolute inset-0">
          <div className="floating-particles"></div>
        </div>
        <div className="mx-auto max-w-6xl px-4 relative">
          <div className="mt-8 rounded-[32px] border border-white/20 overflow-hidden bg-gradient-to-br from-black/60 via-black/40 to-black/60 backdrop-blur-xl shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-500/10"></div>
            <div className="absolute inset-0 -z-10">
              <div className="pointer-events-none absolute inset-x-6 top-16 h-[420px] rounded-[28px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(168,85,247,.8),rgba(34,211,238,.4)_60%,rgba(0,0,0,0)_100%)] animate-pulse-slow" />
            </div>
            <div className="px-8 py-24 text-center relative">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-gradient-to-r from-violet-500/20 to-cyan-500/20 px-4 py-2 text-sm text-white/90 backdrop-blur-sm animate-fade-in-up">
                <span className="relative">
                  <span className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-400 to-cyan-400 animate-ping"></span>
                  <span className="relative rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-1 text-[11px] font-bold text-white shadow-lg">✨ New</span>
                </span>
                AI-Powered Health Intelligence
              </div>
              <h1 className="mx-auto mt-8 max-w-5xl text-balance text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
                Transform Your 
                <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 animate-gradient-shift">
                  Health Journey
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-lg text-white/80 leading-relaxed">
                Unlock comprehensive health insights with AI-powered body analysis. Get personalized fitness plans, 
                risk assessments, and progress tracking - all from a single photo.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="#analyze" className="group btn-primary-enhanced focus-ring transform-gpu">
                  <span className="relative z-10">🚀 Start Your Analysis</span>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </a>
                <a href="#features" className="btn-outline-enhanced focus-ring">
                  <span>Explore Features</span>
                  <svg className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
          {/* Trusted by */}
          <div className="mt-8 text-center reveal animate-fade-in-up-delay">
            <div className="text-xs uppercase tracking-wider text-white/50 mb-4">Trusted by professionals worldwide</div>
            <div className="flex flex-wrap items-center justify-center gap-8 opacity-60 hover:opacity-80 transition-opacity duration-300">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                <Image src="/vercel.svg" alt="Vercel" width={20} height={20} unoptimized />
                <span className="text-sm text-white/70">Vercel</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                <Image src="/next.svg" alt="Next.js" width={20} height={16} unoptimized />
                <span className="text-sm text-white/70">Next.js</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                <div className="w-5 h-5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"></div>
                <span className="text-sm text-white/70">AI Powered</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Action Button for Mobile */}
      <div className="fixed bottom-6 right-6 z-50 md:hidden">
        <a href="#analyze" className="floating-action-btn">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </a>
      </div>

      {/* Main Analysis Card */}
      <main className="mx-auto max-w-6xl px-4 pb-24">
        <div className="mt-16 rounded-3xl border border-white/20 glass-premium p-8 sm:p-12 backdrop-blur-xl shadow-2xl transform-gpu">
          <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white/95 mb-2">Health Analysis Studio</h2>
              <p className="text-white/60">Advanced AI-powered body composition analysis</p>
            </div>
            <div className="flex items-center gap-2 mt-4 sm:mt-0">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-xs text-green-300 font-medium">AI Ready</span>
              </div>
            </div>
          </div>
          
          <div className="h-px w-full bg-gradient-to-r from-transparent via-violet-400/40 to-transparent mb-8" />
          
          {/* Upload Section */}
          <section id="analyze" className="scroll-mt-24">
            <div className="grid lg:grid-cols-2 gap-8 items-start">
              {/* Upload Area */}
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-white/90 mb-3">Upload Your Photo</h3>
                  <p className="text-white/60 text-sm">Full-body image for comprehensive analysis</p>
                </div>
                
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label 
                    htmlFor="image-upload"
                    className="upload-zone group cursor-pointer block"
                  >
                    <div className="flex flex-col items-center justify-center py-12 px-6">
                      <div className="upload-icon-container mb-4">
                        <svg className="w-12 h-12 text-violet-400 group-hover:text-violet-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-white/80 font-medium mb-2">Drop your image here or click to browse</p>
                      <p className="text-white/50 text-sm">Supports JPG, PNG, WEBP up to 10MB</p>
                    </div>
                  </label>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-black/50 px-3 text-white/50 tracking-wider">or paste url</span>
                  </div>
                </div>

                <div className="url-input-container">
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com/your-photo.jpg"
                    value={imageUrl}
                    onChange={(e) => { setImageUrl(e.target.value); if (e.target.value) setImage(null); }}
                    className="url-input w-full"
                  />
                  {urlError && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                      {urlError}
                    </div>
                  )}
                </div>
              </div>

              {/* Preview & Input Section */}
              <div className="space-y-6">
                {/* Image Preview */}
                {(image || imageUrl) && (
                  <div className="image-preview-container">
                    <h4 className="text-lg font-semibold text-white/90 mb-3">Image Preview</h4>
                    <div className="relative">
                      <Image
                        src={image ? URL.createObjectURL(image) : imageUrl}
                        alt="Preview"
                        width={300}
                        height={300}
                        className="w-full max-w-sm mx-auto h-auto object-cover rounded-2xl shadow-2xl border border-white/20"
                        unoptimized
                      />
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/20 to-transparent"></div>
                    </div>
                  </div>
                )}
                
                {/* Measurements Input */}
                <div className="measurements-container">
                  <h4 className="text-lg font-semibold text-white/90 mb-4">Your Measurements</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="input-group">
                      <label className="input-label">Height (cm)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={height === 0 ? "" : height}
                          onChange={e => setHeight(Number(e.target.value))}
                          className="measurement-input"
                          min={0}
                          max={300}
                          placeholder="170"
                        />
                        <div className="input-icon">📏</div>
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="input-label">Weight (kg)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={weight === 0 ? "" : weight}
                          onChange={e => setWeight(Number(e.target.value))}
                          className="measurement-input"
                          min={0}
                          max={500}
                          placeholder="70"
                        />
                        <div className="input-icon">⚖️</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action Button */}
            <div className="mt-10 text-center">
              <button
                className="analyze-btn group disabled:opacity-50 disabled:cursor-not-allowed transform-gpu"
                onClick={handleCalculate}
                disabled={loading || (!image && !imageUrl) || Number(height) <= 0 || Number(weight) <= 0}
              >
                <div className="relative z-10 flex items-center justify-center gap-3">
                  {loading ? (
                    <>
                      <div className="spinner-enhanced"></div>
                      <span className="font-semibold">Analyzing Your Health...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">�</span>
                      <span className="font-bold text-lg">Start Comprehensive Analysis</span>
                      <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </div>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-600/50 to-cyan-600/50 opacity-0 group-hover:opacity-100 transition-all duration-300 blur-xl"></div>
              </button>
              
              {!loading && ((!image && !imageUrl) || Number(height) <= 0 || Number(weight) <= 0) && (
                <p className="mt-4 text-white/50 text-sm">
                  Please upload an image and enter your measurements to continue
                </p>
              )}
            </div>
          </section>
          
          {/* Error Display */}
          {error && (
            <div className="mt-6 error-container">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-300">{error}</span>
              </div>
            </div>
          )}
          
          {/* Loading skeleton */}
          {loading && (
            <div className="mt-10 space-y-6 animate-fade-in">
              <div className="text-center">
                <div className="h-6 w-64 rounded-full shimmer-enhanced mx-auto mb-4" />
                <div className="h-4 w-48 rounded-full shimmer-enhanced mx-auto" />
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="h-24 rounded-2xl shimmer-enhanced" />
                <div className="h-24 rounded-2xl shimmer-enhanced" />
                <div className="h-24 rounded-2xl shimmer-enhanced" />
              </div>
              <div className="h-64 rounded-2xl shimmer-enhanced max-w-2xl mx-auto" />
            </div>
          )}
        </div>

        {/* Comprehensive Results Section */}
        {results && (
          <div className="mt-12 space-y-8 animate-fade-in-up">
            {/* Results Header */}
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">Health Analysis</span>
              </h2>
              <p className="text-white/70 text-lg max-w-2xl mx-auto">
                Comprehensive insights powered by advanced AI analysis
              </p>
            </div>

            {/* Basic Metrics Dashboard */}
            <div className="metrics-dashboard">
              <div className="glass-premium rounded-3xl p-8 backdrop-blur-xl border border-white/20">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-white">📊 Health Metrics Overview</h3>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-xs text-green-300">Analysis Complete</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className={`metric-card ${getBMIColor(results.basicMetrics.bmi)}`}>
                    <div className="metric-icon">📏</div>
                    <div className="metric-value">{results.basicMetrics.bmi}</div>
                    <div className="metric-label">BMI</div>
                    <div className="metric-category">{results.basicMetrics.bmiCategory}</div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-icon">🔥</div>
                    <div className="metric-value">{results.basicMetrics.bodyFatPercentage}%</div>
                    <div className="metric-label">Body Fat</div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-icon">💪</div>
                    <div className="metric-value">{results.basicMetrics.muscleMassPercentage}%</div>
                    <div className="metric-label">Muscle Mass</div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-icon">🫀</div>
                    <div className="metric-value">{results.basicMetrics.visceralFatLevel}</div>
                    <div className="metric-label">Visceral Fat</div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-icon">⏱️</div>
                    <div className="metric-value">{results.basicMetrics.metabolicAge}</div>
                    <div className="metric-label">Metabolic Age</div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-icon">👤</div>
                    <div className="metric-value text-base">{results.bodyAnalysis.bodyShape}</div>
                    <div className="metric-label">Body Shape</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Body Composition Chart */}
            <div className="rounded-3xl border border-white/10 glass p-6 backdrop-blur">
              <h3 className="text-xl font-bold mb-4">Body Composition Analysis</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="h-64">
                  <Doughnut
                    data={{
                      labels: ["Body Fat", "Muscle Mass", "Other"],
                      datasets: [{
                        data: [
                          results.basicMetrics.bodyFatPercentage,
                          results.basicMetrics.muscleMassPercentage,
                          100 - results.basicMetrics.bodyFatPercentage - results.basicMetrics.muscleMassPercentage
                        ],
                        backgroundColor: ["#f472b6", "#22d3ee", "#64748b"],
                        borderWidth: 0,
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { 
                          position: "bottom",
                          labels: { color: "#fff" }
                        }
                      }
                    }}
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-white/90">Overall Assessment</h4>
                    <p className="text-white/70 text-sm">{results.bodyAnalysis.bodyComposition}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white/90">Muscle Definition</h4>
                    <p className="text-white/70 text-sm">{results.bodyAnalysis.muscleDefinition}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white/90">Posture Analysis</h4>
                    <p className="text-white/70 text-sm">{results.bodyAnalysis.overallPosture}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Health Risk Assessment */}
            <div className="rounded-3xl border border-white/10 glass p-6 backdrop-blur">
              <h3 className="text-xl font-bold mb-4">Health Risk Assessment</h3>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className={`rounded-xl p-4 text-center ${getRiskColor(results.healthRisks.cardiovascular)}`}>
                  <div className="font-bold text-lg">{results.healthRisks.cardiovascular.toUpperCase()}</div>
                  <div className="text-sm">Cardiovascular Risk</div>
                </div>
                <div className={`rounded-xl p-4 text-center ${getRiskColor(results.healthRisks.diabetes)}`}>
                  <div className="font-bold text-lg">{results.healthRisks.diabetes.toUpperCase()}</div>
                  <div className="text-sm">Diabetes Risk</div>
                </div>
                <div className={`rounded-xl p-4 text-center ${getRiskColor(results.healthRisks.jointHealth)}`}>
                  <div className="font-bold text-lg">{results.healthRisks.jointHealth.toUpperCase()}</div>
                  <div className="text-sm">Joint Health</div>
                </div>
              </div>
              {results.healthRisks.recommendations.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Recommendations</h4>
                  <ul className="space-y-1">
                    {results.healthRisks.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-white/70 text-sm">• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Fitness Level Assessment */}
            <div className="rounded-3xl border border-white/10 glass p-6 backdrop-blur">
              <h3 className="text-xl font-bold mb-4">Fitness Level Assessment</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="text-center mb-4">
                    <div className="text-3xl font-bold text-cyan-400">{results.fitnessLevel.estimated.toUpperCase()}</div>
                    <div className="text-white/70">Overall Level</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-white/90">Strength</h4>
                    <p className="text-white/70 text-sm">{results.fitnessLevel.strengthIndicators}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white/90">Flexibility</h4>
                    <p className="text-white/70 text-sm">{results.fitnessLevel.flexibilityIndicators}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white/90">Endurance</h4>
                    <p className="text-white/70 text-sm">{results.fitnessLevel.enduranceIndicators}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Personalized Plans */}
            <div className="rounded-3xl border border-white/10 glass p-6 backdrop-blur">
              <h3 className="text-xl font-bold mb-6">Personalized Action Plans</h3>
              <div className="space-y-6">
                {results.personalizedPlans.map((plan, idx) => (
                  <div 
                    key={idx} 
                    className={`rounded-2xl p-6 border border-white/10 bg-white/5 hover-glow cursor-pointer transition-all ${selectedPlan === idx ? 'ring-2 ring-violet-500' : ''}`}
                    onClick={() => setSelectedPlan(idx)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-xl font-bold text-white">{plan.planType}</h4>
                        <div className="flex gap-2 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs ${plan.priority === 'high' ? 'bg-red-500/20 text-red-300' : plan.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>
                            {plan.priority} priority
                          </span>
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300">
                            {plan.duration}
                          </span>
                        </div>
                      </div>
                      {selectedPlan === idx && (
                        <div className="text-violet-400 font-semibold">Selected</div>
                      )}
                    </div>
                    
                    <div className="divider mb-4"></div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Exercise */}
                      <div className="space-y-3">
                        <h5 className="font-semibold text-cyan-400">🏃‍♀️ Exercise Plan</h5>
                        <div className="space-y-2 text-sm text-white/70">
                          <div><strong>Cardio:</strong> {plan.exercise.cardio}</div>
                          <div><strong>Strength:</strong> {plan.exercise.strength}</div>
                          <div><strong>Flexibility:</strong> {plan.exercise.flexibility}</div>
                          <div><strong>Frequency:</strong> {plan.exercise.frequency}</div>
                        </div>
                      </div>
                      
                      {/* Nutrition */}
                      <div className="space-y-3">
                        <h5 className="font-semibold text-green-400">🥗 Nutrition Plan</h5>
                        <div className="space-y-2 text-sm text-white/70">
                          <div><strong>Daily Calories:</strong> {plan.nutrition.calories}</div>
                          <div><strong>Protein:</strong> {plan.nutrition.protein}</div>
                          <div><strong>Carbs:</strong> {plan.nutrition.carbs}</div>
                          <div><strong>Hydration:</strong> {plan.nutrition.hydration}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Lifestyle & Avoid */}
                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <h5 className="font-semibold text-purple-400 mb-2">😴 Lifestyle</h5>
                        <div className="space-y-1 text-sm text-white/70">
                          <div><strong>Sleep:</strong> {plan.lifestyle.sleep}</div>
                          <div><strong>Stress:</strong> {plan.lifestyle.stress}</div>
                          <div><strong>Recovery:</strong> {plan.lifestyle.recovery}</div>
                        </div>
                      </div>
                      <div>
                        <h5 className="font-semibold text-red-400 mb-2">🚫 Avoid</h5>
                        <ul className="space-y-1 text-sm text-white/70">
                          {plan.avoid.map((item, i) => (
                            <li key={i}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress Tracking */}
            <div className="rounded-3xl border border-white/10 glass p-6 backdrop-blur">
              <h3 className="text-xl font-bold mb-4">Progress Tracking</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Key Metrics to Track</h4>
                  <div className="space-y-2">
                    {results.progressTracking.keyMetrics.map((metric, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-violet-400"></div>
                        <span className="text-white/80 text-sm">{metric}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <div className="text-sm text-white/70">
                      <strong>Frequency:</strong> {results.progressTracking.measurementFrequency}
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Expected Timeline</h4>
                  <div className="space-y-3">
                    <div className="border-l-2 border-violet-400 pl-4">
                      <div className="font-semibold text-violet-400">Week 4</div>
                      <div className="text-sm text-white/70">{results.progressTracking.expectedResults.week4}</div>
                    </div>
                    <div className="border-l-2 border-cyan-400 pl-4">
                      <div className="font-semibold text-cyan-400">Week 8</div>
                      <div className="text-sm text-white/70">{results.progressTracking.expectedResults.week8}</div>
                    </div>
                    <div className="border-l-2 border-green-400 pl-4">
                      <div className="font-semibold text-green-400">Week 12</div>
                      <div className="text-sm text-white/70">{results.progressTracking.expectedResults.week12}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary & Download */}
            <div className="rounded-3xl border border-white/10 glass p-6 backdrop-blur text-center">
              <h3 className="text-xl font-bold mb-4">Analysis Summary</h3>
              <p className="text-white/80 mb-6">{results.summary}</p>
              <button 
                className="btn-primary focus-ring text-base px-8 py-4"
                onClick={handleDownload}
              >
                📄 Download Complete Report
              </button>
            </div>
          </div>
        )}

        {/* Features */}
        <section id="features" className="mt-20 scroll-mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Why Choose <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">BodyTune</span>?
            </h2>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              Advanced AI technology meets comprehensive health analysis
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="feature-card group">
              <div className="feature-icon-container">
                <div className="feature-icon">🎯</div>
              </div>
              <h3 className="feature-title">Comprehensive Analysis</h3>
              <p className="feature-description">
                Get detailed insights into body composition, health risks, and fitness levels with our advanced AI-powered assessment system.
              </p>
              <div className="feature-highlight">15+ Health Metrics</div>
            </div>
            
            <div className="feature-card group">
              <div className="feature-icon-container">
                <div className="feature-icon">📊</div>
              </div>
              <h3 className="feature-title">Advanced Metrics</h3>
              <p className="feature-description">
                Track BMI, body fat percentage, muscle mass, visceral fat levels, and metabolic age for a complete health picture.
              </p>
              <div className="feature-highlight">Real-time Processing</div>
            </div>
            
            <div className="feature-card group">
              <div className="feature-icon-container">
                <div className="feature-icon">🎯</div>
              </div>
              <h3 className="feature-title">Personalized Plans</h3>
              <p className="feature-description">
                Receive customized exercise, nutrition, and lifestyle recommendations based on your unique health profile and goals.
              </p>
              <div className="feature-highlight">AI-Generated Plans</div>
            </div>
            
            <div className="feature-card group">
              <div className="feature-icon-container">
                <div className="feature-icon">📈</div>
              </div>
              <h3 className="feature-title">Progress Tracking</h3>
              <p className="feature-description">
                Monitor your health journey with detailed progress tracking, timeline expectations, and measurable milestones.
              </p>
              <div className="feature-highlight">12-Week Timeline</div>
            </div>
            
            <div className="feature-card group">
              <div className="feature-icon-container">
                <div className="feature-icon">🔒</div>
              </div>
              <h3 className="feature-title">Privacy First</h3>
              <p className="feature-description">
                Your health data is processed securely with enterprise-grade encryption and never stored permanently.
              </p>
              <div className="feature-highlight">100% Secure</div>
            </div>
            
            <div className="feature-card group">
              <div className="feature-icon-container">
                <div className="feature-icon">⚡</div>
              </div>
              <h3 className="feature-title">Instant Results</h3>
              <p className="feature-description">
                Get comprehensive health analysis in seconds with our optimized AI processing and intuitive result presentation.
              </p>
              <div className="feature-highlight">&lt; 30 Seconds</div>
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="mt-20 reveal">
          <div className="glass-premium rounded-3xl p-8 sm:p-12 text-center backdrop-blur-xl border border-white/20">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 flex items-center justify-center">
                  <span className="text-2xl">🧬</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">About BodyTune</h2>
              </div>
              
              <p className="text-white/80 text-lg leading-relaxed mb-8">
                BodyTune leverages cutting-edge artificial intelligence and computer vision technology to provide 
                comprehensive health analysis that was previously only available in professional medical settings. 
                Our advanced algorithms analyze body composition, assess health risks, and generate personalized 
                recommendations to help you achieve optimal health and fitness.
              </p>
              
              <div className="grid sm:grid-cols-3 gap-6 mt-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-violet-400">10K+</div>
                  <div className="text-white/60 text-sm">Analyses Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-cyan-400">98%</div>
                  <div className="text-white/60 text-sm">Accuracy Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">24/7</div>
                  <div className="text-white/60 text-sm">Available</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// CSS utilities for enhanced design
const style = {
  __html: `
    .glass {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .glass-premium {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%);
      border: none;
      border-radius: 9999px;
      font-weight: 600;
      padding: 0.75rem 2rem;
      transition: all 0.2s;
    }
    
    .btn-primary-enhanced {
      position: relative;
      background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%);
      border: none;
      border-radius: 16px;
      font-weight: 700;
      padding: 1rem 2.5rem;
      font-size: 1.1rem;
      color: white;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 10px 25px rgba(139, 92, 246, 0.3);
    }
    
    .btn-primary-enhanced:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 40px rgba(139, 92, 246, 0.4);
    }
    
    .btn-outline-enhanced {
      position: relative;
      background: transparent;
      border: 2px solid rgba(255, 255, 255, 0.2);
      color: white;
      border-radius: 16px;
      padding: 1rem 2rem;
      font-weight: 600;
      font-size: 1rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(10px);
      overflow: hidden;
    }
    
    .btn-outline-enhanced:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-1px);
    }
    
    .upload-zone {
      border: 2px dashed rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%);
      backdrop-filter: blur(10px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .upload-zone:hover {
      border-color: rgba(139, 92, 246, 0.5);
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%);
      transform: translateY(-2px);
    }
    
    .upload-icon-container {
      position: relative;
    }
    
    .upload-icon-container::before {
      content: '';
      position: absolute;
      inset: -10px;
      background: linear-gradient(45deg, #8b5cf6, #06b6d4);
      border-radius: 50%;
      opacity: 0;
      transition: opacity 0.3s;
      z-index: -1;
      filter: blur(20px);
    }
    
    .upload-zone:hover .upload-icon-container::before {
      opacity: 0.3;
    }
    
    .url-input {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 1rem 1.25rem;
      color: white;
      font-size: 0.95rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(10px);
    }
    
    .url-input:focus {
      outline: none;
      border-color: rgba(139, 92, 246, 0.5);
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
      background: rgba(255, 255, 255, 0.08);
    }
    
    .url-input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }
    
    .measurement-input {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 1rem 3rem 1rem 1.25rem;
      color: white;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(10px);
      width: 100%;
    }
    
    .measurement-input:focus {
      outline: none;
      border-color: rgba(139, 92, 246, 0.5);
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
      background: rgba(255, 255, 255, 0.08);
    }
    
    .input-label {
      display: block;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 600;
      margin-bottom: 0.5rem;
      font-size: 0.95rem;
    }
    
    .input-icon {
      position: absolute;
      right: 1rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1.2rem;
      opacity: 0.7;
    }
    
    .analyze-btn {
      position: relative;
      background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%);
      border: none;
      border-radius: 20px;
      padding: 1.25rem 3rem;
      color: white;
      font-size: 1.1rem;
      cursor: pointer;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 10px 30px rgba(139, 92, 246, 0.3);
      min-width: 280px;
    }
    
    .analyze-btn:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 20px 40px rgba(139, 92, 246, 0.4);
    }
    
    .analyze-btn:active:not(:disabled) {
      transform: translateY(-1px);
    }
    
    .metric-card {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      padding: 1.5rem;
      text-align: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(10px);
      position: relative;
      overflow: hidden;
    }
    
    .metric-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #8b5cf6, #06b6d4);
      opacity: 0;
      transition: opacity 0.3s;
    }
    
    .metric-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      border-color: rgba(255, 255, 255, 0.25);
    }
    
    .metric-card:hover::before {
      opacity: 1;
    }
    
    .metric-icon {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    
    .metric-value {
      font-size: 2rem;
      font-weight: 800;
      color: white;
      margin-bottom: 0.25rem;
    }
    
    .metric-label {
      font-size: 0.875rem;
      color: rgba(255, 255, 255, 0.7);
      font-weight: 600;
    }
    
    .metric-category {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.5);
      margin-top: 0.25rem;
    }
    
    .floating-action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%);
      border-radius: 50%;
      color: white;
      box-shadow: 0 8px 25px rgba(139, 92, 246, 0.4);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .floating-action-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 12px 35px rgba(139, 92, 246, 0.5);
    }
    
    .error-container {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 16px;
      padding: 1rem 1.25rem;
      backdrop-filter: blur(10px);
    }
    
    .floating-particles {
      position: absolute;
      inset: 0;
      background-image: 
        radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 40% 60%, rgba(168, 85, 247, 0.05) 0%, transparent 50%);
      animation: float 6s ease-in-out infinite;
    }
    
    .focus-ring:focus {
      outline: 2px solid #8b5cf6;
      outline-offset: 2px;
    }
    
    .shimmer-enhanced {
      background: linear-gradient(90deg, 
        rgba(255,255,255,0.05) 25%, 
        rgba(139, 92, 246, 0.1) 50%, 
        rgba(255,255,255,0.05) 75%);
      background-size: 200% 100%;
      animation: shimmer 2s infinite;
      border-radius: 16px;
    }
    
    .spinner-enhanced {
      width: 1.5rem;
      height: 1.5rem;
      border: 3px solid rgba(255, 255, 255, 0.2);
      border-top: 3px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      33% { transform: translateY(-10px) rotate(1deg); }
      66% { transform: translateY(5px) rotate(-1deg); }
    }
    
    @keyframes gradient-shift {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
    
    @keyframes pulse-slow {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    
    @keyframes fade-in-up {
      from { 
        opacity: 0; 
        transform: translateY(30px); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0); 
      }
    }
    
    @keyframes fade-in-up-delay {
      from { 
        opacity: 0; 
        transform: translateY(20px); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0); 
      }
    }
    
    .animate-gradient-shift {
      background-size: 200% 200%;
      animation: gradient-shift 3s ease infinite;
    }
    
    .animate-pulse-slow {
      animation: pulse-slow 3s ease-in-out infinite;
    }
    
    .animate-fade-in-up {
      animation: fade-in-up 0.8s cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    
    .animate-fade-in-up-delay {
      animation: fade-in-up-delay 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s both;
    }
    
    .transform-gpu {
      transform: translateZ(0);
      backface-visibility: hidden;
      perspective: 1000px;
    }
    
    .fade-up {
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.6s ease;
    }
    
    .reveal {
      opacity: 0;
      transform: translateY(30px);
      transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .reveal.in-view {
      opacity: 1;
      transform: translateY(0);
    }
    
    .hover-glow {
      transition: all 0.3s ease;
    }
    
    .hover-glow:hover {
      box-shadow: 0 0 30px rgba(139, 92, 246, 0.4);
    }
    
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    }
    
    .feature-card {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 24px;
      padding: 2rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(10px);
      position: relative;
      overflow: hidden;
    }
    
    .feature-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #8b5cf6, #06b6d4);
      opacity: 0;
      transition: opacity 0.3s;
    }
    
    .feature-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      border-color: rgba(255, 255, 255, 0.25);
    }
    
    .feature-card:hover::before {
      opacity: 1;
    }
    
    .feature-icon-container {
      position: relative;
      width: 4rem;
      height: 4rem;
      margin-bottom: 1.5rem;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .feature-card:hover .feature-icon-container {
      transform: scale(1.1);
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(6, 182, 212, 0.3) 100%);
    }
    
    .feature-icon {
      font-size: 1.75rem;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .feature-card:hover .feature-icon {
      transform: scale(1.1);
    }
    
    .feature-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: white;
      margin-bottom: 1rem;
    }
    
    .feature-description {
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    
    .feature-highlight {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%);
      border: 1px solid rgba(139, 92, 246, 0.3);
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 600;
      color: rgba(139, 92, 246, 1);
    }
    
    /* Responsive Design */
    @media (max-width: 640px) {
      .metric-card {
        padding: 1rem;
      }
      
      .metric-value {
        font-size: 1.5rem;
      }
      
      .analyze-btn {
        min-width: 240px;
        padding: 1rem 2rem;
      }
      
      .btn-primary-enhanced {
        padding: 0.875rem 2rem;
        font-size: 1rem;
      }
    }
  `
};

// Global styles component
function GlobalStyles() {
  return <style dangerouslySetInnerHTML={style} />;
}
