import { LandingNav } from "@/app/components/landing/landing-nav";
import { Hero } from "@/app/components/landing/hero";
import { FeaturesOverview } from "@/app/components/landing/features-overview";
import { FeatureSections } from "@/app/components/landing/feature-sections";
import { LandingFooter } from "@/app/components/landing/landing-footer";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1A2DAB] blueprint-grid text-white">
      {/* Ambient blueprint glows */}
      <div
        aria-hidden
        className="blueprint-drift pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-[#FF4D2E]/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[60%] -left-40 h-96 w-96 rounded-full bg-cyan-400/10 blur-[120px]"
      />

      <LandingNav />
      <main className="relative">
        <Hero />
        <FeaturesOverview />
        <FeatureSections />
        <LandingFooter />
      </main>
    </div>
  );
}
