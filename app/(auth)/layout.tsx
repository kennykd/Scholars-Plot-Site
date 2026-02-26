export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen blueprint-grid flex items-center justify-center px-4">
      {children}
    </div>
  );
}
