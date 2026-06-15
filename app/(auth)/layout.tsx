export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1A2DAB] blueprint-grid text-white">
      {/* Ambient blueprint glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-[#FF4D2E]/15 blur-[120px]"
      />
      {children}
    </div>
  );
}
