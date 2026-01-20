"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import Groq from "groq-sdk";

// --- FORMATTER HELPER ---
function formatPublishedTime(dateInput: string) {
  const now = new Date();
  const past = new Date(dateInput);
  const diff = Math.floor((now.getTime() - past.getTime()) / 1000);
  if (diff < 60) return "Just Now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function SentinExPage() {
  const [newsList, setNewsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initIntelligence() {
      try {
        const q = query(collection(db, "news"), orderBy("createdAt", "desc"), limit(10));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          setNewsList(snapshot.docs.map(doc => doc.data()));
          setLoading(false);
          return;
        }

        const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
        const data = await res.json();
        if (!data.Data) return;
        const rawNews = data.Data.slice(0, 5);

        const groq = new Groq({ 
            apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || "",
            dangerouslyAllowBrowser: true 
        });

        const analyzedResults = [];
        for (const news of rawNews) {
          try {
            const chatCompletion = await groq.chat.completions.create({
              messages: [
                {
                  role: "user",
                  content: `Analyze this crypto news: "${news.title}". 
                  STRICT REQUIREMENT: REPLY IN ENGLISH.
                  Return ONLY JSON: {"score": 0.8, "label": "BULLISH", "summary": "One professional English sentence summary"}`
                }
              ],
              model: "llama-3.1-8b-instant",
              response_format: { type: "json_object" }
            });

            const analysis = JSON.parse(chatCompletion.choices[0]?.message?.content || "{}");
            const finalData = {
              title: news.title,
              url: news.url,
              analysis: analysis,
              createdAt: new Date().toISOString()
            };
            await addDoc(collection(db, "news"), finalData);
            analyzedResults.push(finalData);
          } catch (e) { console.error(e); }
        }
        setNewsList(analyzedResults);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    initIntelligence();
  }, []);

  return (
    <main className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-cyan-500/30">
      
      {/* 1. TOP TICKER BAR */}
      <div className="bg-slate-950/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50 overflow-hidden py-2.5">
        <div className="flex animate-marquee space-x-12 whitespace-nowrap">
            {['BTC/USDT $142,530 +2.4%', 'ETH/USDT $8,210 -1.1%', 'SNX/USDT $12.45 +15.2%', 'SOL/USDT $412.0 +5.7%'].map((t, i) => (
                <span key={i} className="text-[11px] font-mono font-bold text-cyan-400 tracking-tighter uppercase">{t}</span>
            ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-16 pb-24">
        {/* MAIN GRID WRAPPER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          
          {/* LEFT COLUMN: Header & News Feed */}
          <div className="lg:col-span-8">
            <header className="mb-24">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center font-black text-black italic text-xl shadow-[0_0_20px_rgba(6,182,212,0.3)]">S</div>
                    <span className="text-[10px] font-black tracking-[0.4em] text-cyan-500 uppercase">Neural Intelligence Protocol</span>
                </div>
                <h1 className="text-7xl font-black tracking-tighter text-white mb-6 leading-none">SENTI<span className="text-cyan-500">NEX</span></h1>
                <p className="text-slate-400 text-xl max-w-2xl font-medium leading-relaxed">
                    Processing global market news through decentralized AI nodes to extract actionable sentiment and alpha.
                </p>
            </header>

            <div className="space-y-20">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-10 flex items-center gap-4">
                <span className="w-8 h-px bg-slate-800"></span> 
                Live Intelligence Stream
              </h3>

              {!loading ? newsList.map((item, index) => (
                <article key={index} className="group relative pl-0 md:pl-8">
                  <div className="hidden md:block absolute left-0 top-0 bottom-0 w-px bg-slate-800 group-hover:bg-cyan-500 transition-colors duration-500"></div>
                  <div className="flex items-center gap-4 mb-4">
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded ${
                      item.analysis.label === 'BULLISH' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-rose-500/10 text-rose-500'
                    }`}>
                      {item.analysis.label}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">{formatPublishedTime(item.createdAt)}</span>
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-6 group-hover:text-cyan-400 transition-colors tracking-tight">{item.title}</h2>
                  <div className="bg-slate-900/30 p-7 rounded-2xl border border-white/5 backdrop-blur-sm group-hover:border-white/10 transition-all">
                      <p className="text-slate-400 text-lg leading-relaxed font-medium italic">"{item.analysis.summary}"</p>
                  </div>
                  <div className="mt-6 flex justify-between items-center pb-8 border-b border-white/5">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Inference Engine: Llama 3.3</span>
                      <a href={item.url} target="_blank" className="text-[10px] font-black text-cyan-500 hover:text-white uppercase tracking-widest">Verify Source →</a>
                  </div>
                </article>
              )) : (
                <div className="py-20 text-center animate-pulse text-cyan-500 font-mono text-xs tracking-[0.3em]">SYNCHRONIZING_STREAM...</div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Sidebar (Aligned to the very top) */}
          <aside className="lg:col-span-4 lg:pt-0 mt-10 lg:mt-0">
            <div className="sticky top-24 space-y-8">
              {/* SENTINEX Vault Card */}
              <div className="bg-gradient-to-br from-cyan-600 to-blue-700 p-8 rounded-[2.5rem] shadow-2xl shadow-cyan-500/20 border border-white/10 transition-transform hover:scale-[1.01]">
                  <h3 className="text-xs font-black tracking-[0.2em] mb-10 text-white/70 uppercase">SENTINEX Vault</h3>
                  <div className="space-y-8 text-white">
                      <div>
                          <p className="text-[10px] font-bold uppercase opacity-60 mb-2 tracking-widest">Global Market Bias</p>
                          <p className="text-4xl font-black italic uppercase tracking-tighter leading-none">Strong Buy</p>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-bold uppercase mb-2 opacity-80">
                          <span>Confidence Level</span>
                          <span>94.2%</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                          <div className="w-[94%] h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                        </div>
                      </div>
                      <button className="w-full bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-cyan-50 transition-all active:scale-[0.98] shadow-xl">
                          Stake SNX Token
                      </button>
                  </div>
              </div>

              {/* Momentum Card */}
              <div className="p-8 border border-white/5 rounded-[2rem] bg-slate-900/20 backdrop-blur-xl">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8">Narratives</h4>
                <div className="space-y-5">
                  {['Decentralized AI', 'RWA Tokenization', 'DePIN Networks'].map((tag, i) => (
                    <div key={i} className="flex items-center justify-between group">
                      <span className="text-sm font-bold text-slate-400 group-hover:text-white transition-colors">{tag}</span>
                      <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_cyan]"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

        </div>

        {/* FOOTER */}
        <footer className="mt-40 border-t border-white/5 pt-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="text-[10px] font-bold text-slate-600 tracking-[0.3em] uppercase">Sentinex Protocol &copy; 2026</p>
          <div className="flex gap-10 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">
            <span className="hover:text-cyan-500 cursor-pointer transition-colors">Nodes</span>
            <span className="hover:text-cyan-500 cursor-pointer transition-colors">Ecosystem</span>
            <span className="hover:text-cyan-500 cursor-pointer transition-colors">Docs</span>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
        .animate-marquee { display: flex; animation: marquee 40s linear infinite; }
        body { background-color: #020617; }
      `}</style>
    </main>
  );
}