import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#1A2DAB] blueprint-grid relative overflow-hidden">
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <Link href="/" className="font-display text-xl font-bold text-white">
          Scholar&apos;s Plot
        </Link>
        
        <div className="hidden md:flex items-center gap-8">
          <Link href="#features" className="text-white/80 hover:text-white text-sm transition-colors">
            Features
          </Link>
          <Link href="#calendar" className="text-white/80 hover:text-white text-sm transition-colors">
            Calendar
          </Link>
          <Link href="#timer" className="text-white/80 hover:text-white text-sm transition-colors">
            Timer
          </Link>
          <Link href="#ai" className="text-white/80 hover:text-white text-sm transition-colors">
            AI
          </Link>
          <Link href="#analytics" className="text-white/80 hover:text-white text-sm transition-colors">
            Analytics
          </Link>
          <Link href="#contact" className="text-white/80 hover:text-white text-sm transition-colors">
            Contact
          </Link>
        </div>

        <Button 
          asChild
          className="bg-[#FF4D2E] hover:bg-[#e04327] text-white font-semibold px-6"
        >
          <Link href="/login">Start Building</Link>
        </Button>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex items-center min-h-[calc(100vh-80px)] px-8 lg:px-16">
        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <p className="font-mono text-xs tracking-[0.3em] text-[#FF4D2E] uppercase">
              Scholar&apos;s Plot — V1.0
            </p>
            
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[0.95]">
              <span className="text-white block">BUILD YOUR</span>
              <span className="text-[#FF4D2E] block">SEMESTER</span>
            </h1>
            
            <p className="text-white/70 text-lg max-w-md leading-relaxed">
              A study planner forged like a work site: clear plans, solid schedules, and tools that actually get the job done.
            </p>
            
            <Button 
              asChild
              size="lg"
              className="bg-[#FF4D2E] hover:bg-[#e04327] text-white font-semibold px-8 py-6 text-base"
            >
              <Link href="/login">Start Building</Link>
            </Button>
          </div>

          {/* Right Content - Product Preview */}
          <div className="hidden lg:flex justify-center items-center">
            <div className="relative">
              {/* Main dashboard preview */}
              <div className="w-[500px] h-[350px] bg-[#0f1a66]/80 rounded-lg border border-white/10 backdrop-blur-sm shadow-2xl transform rotate-[-5deg] hover:rotate-0 transition-transform duration-500">
                <div className="p-6 h-full flex flex-col">
                  {/* Mock UI header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-mono text-xs text-white/60 tracking-wider">WEEKLY SCHEDULE</div>
                    <div className="flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-white/20"></div>
                      <div className="w-2 h-2 rounded-full bg-white/20"></div>
                    </div>
                  </div>
                  
                  {/* Mock calendar grid */}
                  <div className="flex-1 grid grid-cols-7 gap-2">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
                      <div key={day} className="text-center">
                        <div className="text-[10px] text-white/40 mb-1">{day}</div>
                        <div className={`h-16 rounded ${i === 2 ? "bg-[#FF4D2E]/30" : "bg-white/5"} border ${i === 2 ? "border-[#FF4D2E]/50" : "border-white/10"}`}>
                          {i === 2 && (
                            <div className="p-1">
                              <div className="text-[8px] text-white/80 truncate">Calc Study</div>
                              <div className="text-[7px] text-white/50">2 PM</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Mock stats */}
                  <div className="mt-4 flex gap-4">
                    <div className="flex-1 bg-white/5 rounded p-3 border border-white/10">
                      <div className="text-[10px] text-white/40 mb-1">STUDY HOURS</div>
                      <div className="text-lg font-bold text-white">24.5</div>
                    </div>
                    <div className="flex-1 bg-white/5 rounded p-3 border border-white/10">
                      <div className="text-[10px] text-white/40 mb-1">TASKS DONE</div>
                      <div className="text-lg font-bold text-white">12</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Secondary floating card */}
              <div className="absolute -bottom-4 -right-4 w-[280px] h-[180px] bg-white rounded-lg shadow-2xl transform rotate-[3deg] hover:rotate-0 transition-transform duration-500">
                <div className="p-4 h-full">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded bg-[#FF4D2E] flex items-center justify-center">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">1 / 5</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-800 mb-1">TASK MANAGEMENT</div>
                  <div className="text-xs text-gray-500 leading-relaxed">
                    Create, organize, and prioritize assignments with smart deadlines.
                  </div>
                  <div className="mt-3 flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF4D2E]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
