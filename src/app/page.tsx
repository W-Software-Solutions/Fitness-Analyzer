"use client"
import Image from "next/image";
import jsPDF from "jspdf";

import { useState, ChangeEvent } from "react";
import { getGeminiFitnessPlan } from "./geminiApi";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [height, setHeight] = useState<number>(0);
  const [weight, setWeight] = useState<number>(0);
  const [bmi, setBmi] = useState<number | null>(null);
  const [bodyFat, setBodyFat] = useState<number | null>(null);
  const [muscleMass, setMuscleMass] = useState<number | null>(null);
  interface FitnessPlan {
    title: string;
    exercise: string;
    diet: string;
    sleep: string;
    avoid: string;
  }
  interface FitnessPlanResults {
    bodyComposition: string;
    plans: FitnessPlan[];
  }
  const [results, setResults] = useState<FitnessPlanResults | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [selectedPlan, setSelectedPlan] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  // Removed unused rawGemini state

  function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  }

  async function handleCalculate() {
    if (height > 0 && weight > 0 && image) {
      setLoading(true);
      setResults(null);
      setSummary("");
      setBmi(null);
      setBodyFat(null);
      setMuscleMass(null);
  // Removed unused setRawGemini
      try {
        const response = await getGeminiFitnessPlan({ imageFile: image, height, weight });
  // Removed unused setRawGemini
        // Parse Gemini response into a structured object
        const lines = response.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const parsed = {
          bmi: null as number | null,
          bodyFat: null as number | null,
          muscleMass: null as number | null,
          bodyComposition: "",
          summary: "",
          plans: [] as FitnessPlan[],
        };
  let currentPlan: FitnessPlan | null = null;
        for (const line of lines) {
          if (/^BMI[:\s]/i.test(line)) parsed.bmi = parseFloat(line.replace(/[^\d\.]/g, ""));
          else if (/^Body Fat/i.test(line)) parsed.bodyFat = parseFloat(line.replace(/[^\d\.]/g, ""));
          else if (/^Muscle Mass/i.test(line)) parsed.muscleMass = parseFloat(line.replace(/[^\d\.]/g, ""));
          else if (/^Body Composition[:\s]/i.test(line)) parsed.bodyComposition = line.replace(/^Body Composition[:\s]*/i, "");
          else if (/^Summary[:\s]/i.test(line)) parsed.summary = line.replace(/^Summary[:\s]*/i, "");
          else if (/^Plan/i.test(line) || /^Title[:\s]/i.test(line)) {
            if (currentPlan) parsed.plans.push(currentPlan);
            currentPlan = { title: "", exercise: "", diet: "", sleep: "", avoid: "" };
            currentPlan.title = line.replace(/^Plan[:\s]*/i, "").replace(/^Title[:\s]*/i, "");
          } else if (/^Exercise[:\s]/i.test(line) && currentPlan) currentPlan.exercise = line.replace(/^Exercise[:\s]*/i, "");
          else if (/^Diet[:\s]/i.test(line) && currentPlan) currentPlan.diet = line.replace(/^Diet[:\s]*/i, "");
          else if (/^Sleep[:\s]/i.test(line) && currentPlan) currentPlan.sleep = line.replace(/^Sleep[:\s]*/i, "");
          else if (/^Avoid[:\s]/i.test(line) && currentPlan) currentPlan.avoid = line.replace(/^Avoid[:\s]*/i, "");
        }
        if (currentPlan) parsed.plans.push(currentPlan);
        setBmi(parsed.bmi ?? null);
        setBodyFat(parsed.bodyFat ?? null);
        setMuscleMass(parsed.muscleMass ?? null);
        setSummary(parsed.summary || "Not available");
        setResults({
          bodyComposition: parsed.bodyComposition || "Not available",
          plans: parsed.plans.filter((p: FitnessPlan) => (p.title && p.title !== "Not available") || p.exercise || p.diet || p.sleep || p.avoid),
        });
      } catch (e: unknown) {
        setSummary("Error: " + (e instanceof Error ? e.message : String(e)));
      }
      setLoading(false);
    }
  }

  function handleDownload(plan: FitnessPlan) {
    // Use jsPDF to generate a full PDF report matching the frontend
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(20);
    doc.text("W Software Solutions - Fitness Report", 20, y);
    y += 12;
    doc.setFontSize(12);
    doc.text(`Height: ${height} cm`, 20, y); y += 8;
    doc.text(`Weight: ${weight} kg`, 20, y); y += 8;
    doc.text(`BMI: ${bmi ?? "Not available"}`, 20, y); y += 8;
    doc.text(`Body Fat %: ${bodyFat ?? "Not available"}`, 20, y); y += 8;
    doc.text(`Muscle Mass %: ${muscleMass ?? "Not available"}`, 20, y); y += 8;
    doc.text(`Body Composition: ${results?.bodyComposition ?? "Not available"}`, 20, y); y += 8;
    doc.text(`Summary: ${summary ?? "Not available"}`, 20, y); y += 12;
    doc.setFontSize(16);
    doc.text("Personalized Plans", 20, y); y += 10;
    doc.setFontSize(12);
  results?.plans.forEach((p: FitnessPlan, idx: number) => {
      console.log(p.title)
      doc.text(`Plans ${idx + 1}: ${p.title ?? "Not available"}`, 20, y); y += 8;
      console.log(p.exercise)
      doc.text(`  Exercise: ${p.exercise ?? "Not available"}`, 20, y); y += 8;
      console.log(p.diet)
      doc.text(`  Diet: ${p.diet ?? "Not available"}`, 20, y); y += 8;
      console.log(p.sleep)
      doc.text(`  Sleep: ${p.sleep ?? "Not available"}`, 20, y); y += 8;
      console.log(p.avoid)
      doc.text(`  Avoid: ${p.avoid ?? "Not available"}`, 20, y); y += 10;
    });
    doc.save(`${plan.title.replace(/ /g, "_")}_Fitness_Report.pdf`);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-72 bg-gradient-to-b from-indigo-900 to-blue-700 text-white flex flex-col py-10 px-6 shadow-2xl border-r-2 border-indigo-800">
        <div className="flex items-center gap-3 mb-10">
          <Image src="/next.svg" alt="W Software Solutions" width={40} height={40} />
          <span className="text-2xl font-extrabold tracking-wide">W Software Solutions</span>
        </div>
        <nav className="flex flex-col gap-6 mt-8">
          <a className="text-lg font-semibold hover:text-blue-200 transition" href="#dashboard">Dashboard</a>
          <a className="text-lg font-semibold hover:text-blue-200 transition" href="#analyze">Analyze</a>
          <a className="text-lg font-semibold hover:text-blue-200 transition" href="#plans">Plans</a>
          <a className="text-lg font-semibold hover:text-blue-200 transition" href="#reports">Reports</a>
        </nav>
        <div className="mt-auto pt-10 text-xs text-blue-200">© 2025 W Software Solutions</div>
      </aside>
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="w-full bg-white shadow-lg py-6 px-10 flex items-center justify-between border-b-2 border-indigo-200">
          <h1 className="text-3xl font-black text-indigo-900 tracking-tight">Fitness SaaS Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-indigo-700 font-bold">Welcome, User</span>
            <Image src="/next.svg" alt="User Avatar" width={32} height={32} className="rounded-full" />
          </div>
        </header>
        {/* Dashboard Body */}
        <main className="flex-1 flex flex-col items-center justify-start py-12 px-6 animate-fade-in">
          <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-12 border-2 border-indigo-100 flex flex-col gap-10">
            {/* Stepper */}
            <div className="flex justify-center mb-8">
              <div className="flex gap-10">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-indigo-700 text-white flex items-center justify-center text-2xl font-bold shadow-lg border-4 border-indigo-300">1</div>
                  <span className="mt-2 text-indigo-800 font-bold">Upload</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg border-4 border-blue-300">2</div>
                  <span className="mt-2 text-blue-800 font-bold">Input</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg border-4 border-green-300">3</div>
                  <span className="mt-2 text-green-800 font-bold">Results</span>
                </div>
              </div>
            </div>
            {/* Upload Section */}
            <section id="analyze" className="flex flex-col gap-2 items-center">
              <label className="block text-2xl font-extrabold text-indigo-800">Upload Full-Body Image</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-base file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition" />
              {image && (
                <Image
                  src={URL.createObjectURL(image)}
                  alt="Preview"
                  width={176}
                  height={176}
                  className="w-44 h-44 object-cover rounded-2xl mx-auto mt-4 border-4 border-indigo-300 shadow-xl animate-fade-in"
                  unoptimized
                />
              )}
            </section>
            {/* Input Section */}
            <section className="flex gap-10 justify-center">
              <div className="flex flex-col flex-1">
                <label className="text-lg text-indigo-700 font-bold">Height (cm)</label>
                <input
                  type="number"
                  value={height === 0 ? "" : height}
                  onChange={e => setHeight(Number(e.target.value))}
                  className="border-4 border-indigo-400 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-600 text-xl font-semibold bg-white text-indigo-900 placeholder-indigo-300"
                  min={0}
                  placeholder="Enter height"
                />
              </div>
              <div className="flex flex-col flex-1">
                <label className="text-lg text-indigo-700 font-bold">Weight (kg)</label>
                <input
                  type="number"
                  value={weight === 0 ? "" : weight}
                  onChange={e => setWeight(Number(e.target.value))}
                  className="border-4 border-indigo-400 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-600 text-xl font-semibold bg-white text-indigo-900 placeholder-indigo-300"
                  min={0}
                  placeholder="Enter weight"
                />
              </div>
            </section>
            {/* Action Button */}
            <button
              className="bg-gradient-to-r from-indigo-700 to-blue-600 text-white rounded-full px-10 py-5 font-black text-2xl shadow-xl hover:scale-105 hover:from-indigo-800 hover:to-blue-700 transition-all duration-200 tracking-wide border-4 border-indigo-400 mt-2 disabled:opacity-50"
              onClick={handleCalculate}
              disabled={loading || !image || !height || !weight}
            >
              {loading ? "Analyzing..." : "🚀 Analyze & Get Plans"}
            </button>
            {/* Results Section */}
            {(bmi !== null || bodyFat !== null || muscleMass !== null || results?.bodyComposition || summary) && (
              <section id="results" className="mt-8 text-center animate-fade-in">
                <div className="flex flex-col items-center gap-2">
                  <div className="text-3xl font-black text-indigo-700 mb-2">Your Health Analysis</div>
                  <div className="flex flex-wrap justify-center gap-6 mb-4">
                    <div className="bg-blue-50 rounded-xl px-4 py-2 shadow text-lg font-bold text-indigo-700">Height: {height} cm</div>
                    <div className="bg-blue-50 rounded-xl px-4 py-2 shadow text-lg font-bold text-indigo-700">Weight: {weight} kg</div>
                    <div className="bg-blue-50 rounded-xl px-4 py-2 shadow text-lg font-bold text-blue-600">BMI: {bmi ?? "Not available"}</div>
                    <div className="bg-pink-50 rounded-xl px-4 py-2 shadow text-lg font-bold text-pink-600">Body Fat %: {bodyFat ?? "Not available"}</div>
                    <div className="bg-green-50 rounded-xl px-4 py-2 shadow text-lg font-bold text-green-600">Muscle Mass %: {muscleMass ?? "Not available"}</div>
                  </div>
                  <div className="text-xl text-green-700 font-bold">Body Composition: {results?.bodyComposition ?? "Not available"}</div>
                  <div className="mt-2 text-lg text-indigo-600 font-semibold">Summary: {summary ?? "Not available"}</div>
                  {(bodyFat !== null || muscleMass !== null) && (
                    <div className="w-full max-w-md mx-auto mt-6">
                      <Bar
                        data={{
                          labels: ["Body Fat %", "Muscle Mass %"],
                          datasets: [
                            {
                              label: "Composition",
                              data: [bodyFat ?? 0, muscleMass ?? 0],
                              backgroundColor: ["#f472b6", "#34d399"],
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { display: false },
                            title: { display: true, text: "Body Composition" },
                          },
                          scales: {
                            y: { beginAtZero: true, max: 100 },
                          },
                        }}
                      />
                    </div>
                  )}
                </div>
              </section>
            )}
            {results && (
              <section id="plans" className="mt-10 animate-fade-in">
                <h2 className="text-2xl font-extrabold mb-6 text-indigo-800">Personalized Plans</h2>
                <div className="grid gap-8">
                  {results.plans.length === 0 ? (
                    <div className="text-lg text-indigo-500 bg-indigo-50 rounded-xl p-6 shadow text-center">No personalized plans available. Please try again or adjust your inputs.</div>
                  ) : (
                    results.plans.map((plan: FitnessPlan, idx: number) => (
                      <div key={idx} className={`border-4 border-indigo-300 rounded-3xl p-8 bg-gradient-to-br from-white to-indigo-50 shadow-2xl hover:scale-105 transition-all duration-200 cursor-pointer relative ${selectedPlan === idx ? 'ring-4 ring-indigo-500' : ''}`}
                        onClick={() => setSelectedPlan(idx)}
                      >
                        <div className="absolute top-4 right-4 text-2xl font-bold text-indigo-400">Plan {idx + 1}</div>
                        <div className="font-black text-indigo-800 text-2xl mb-4 tracking-wide flex items-center gap-2">
                          <span className="inline-block w-2 h-8 bg-indigo-400 rounded-full mr-2"></span>
                          {plan.title}
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-blue-100 rounded-xl p-4 flex flex-col items-start shadow">
                            <div className="text-lg font-bold text-blue-700 mb-1 flex items-center gap-2">🧘‍♂️ Exercise</div>
                            <div className="text-blue-700 text-base">{plan.exercise}</div>
                          </div>
                          <div className="bg-green-100 rounded-xl p-4 flex flex-col items-start shadow">
                            <div className="text-lg font-bold text-green-700 mb-1 flex items-center gap-2">🍽️ Diet</div>
                            <div className="text-green-700 text-base">{plan.diet}</div>
                          </div>
                          <div className="bg-indigo-100 rounded-xl p-4 flex flex-col items-start shadow">
                            <div className="text-lg font-bold text-indigo-700 mb-1 flex items-center gap-2">😴 Sleep</div>
                            <div className="text-indigo-700 text-base">{plan.sleep}</div>
                          </div>
                          <div className="bg-red-100 rounded-xl p-4 flex flex-col items-start shadow">
                            <div className="text-lg font-bold text-red-600 mb-1 flex items-center gap-2">🚫 Avoid</div>
                            <div className="text-red-600 text-base">{plan.avoid}</div>
                          </div>
                        </div>
                        {selectedPlan === idx && <div className="mt-2 text-indigo-600 font-bold text-lg">Selected</div>}
                      </div>
                    ))
                  )}
                </div>
                <button className="mt-10 bg-gradient-to-r from-indigo-500 to-blue-500 text-white px-10 py-4 rounded-full font-bold hover:scale-105 transition-all duration-200 text-2xl shadow-md border-2 border-indigo-300 w-full" onClick={() => handleDownload({
                  title: results?.plans[selectedPlan]?.title ?? "Fitness Report",
                  exercise: results?.plans[selectedPlan]?.exercise ?? "",
                  diet: results?.plans[selectedPlan]?.diet ?? "",
                  sleep: results?.plans[selectedPlan]?.sleep ?? "",
                  avoid: results?.plans[selectedPlan]?.avoid ?? ""
                })}>Download Full Report PDF</button>
              </section>
            )}
          </div>
        </main>
        <footer className="w-full py-8 bg-white text-center text-indigo-900 text-lg font-bold shadow-inner border-t-2 border-indigo-200 animate-fade-in">© 2025 W Software Solutions. All rights reserved.</footer>
      </div>
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.7s cubic-bezier(.4,0,.2,1) both;
        }
      `}</style>
    </div>
  );
}
