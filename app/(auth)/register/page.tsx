"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/app/components/auth/auth-shell";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const createSession = async (idToken: string, name?: string) => {
    const res = await fetch("/api/auth/firebase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to create session");
  };

  const handleGoogleSignUp = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await createSession(idToken, displayName);
      toast.success("Account created! Welcome 🎉");
      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err?.code === "auth/popup-closed-by-user") {
        toast.error("Google sign-up cancelled");
        return;
      }
      toast.error(err?.message || "Sign-up failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      setLoading(true);
      const result = await createUserWithEmailAndPassword(auth, email, password);

      const actionCodeSettings = {
        // Make sure this matches your Next.js route structure exactly!
        url: 'http://localhost:3000/register/verify',
        handleCodeInApp: true,
      };

      // Send standard email verification
      await sendEmailVerification(result.user, actionCodeSettings);

      // UNIFIED STORAGE KEY
      window.localStorage.setItem("emailForVerification", email);

      toast.success("Verification link sent! Please check your email.");
      router.push("/register/verify");
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      let message = "Registration failed";
      if (err?.code === "auth/email-already-in-use")
        message = "Email already in use";
      else if (err?.code === "auth/weak-password")
        message = "Password too weak (min 6 chars)";
      else if (err?.code === "auth/invalid-email")
        message = "Invalid email format";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="blueprint-ticks rounded-2xl border border-white/10 bg-[#0f1a66]/80 p-8 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="mb-8 space-y-1.5">
          <p className="font-mono text-[11px] tracking-[0.25em] text-[#FF4D2E]">
            CREATE YOUR SITE
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white">
            Start building
          </h1>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <Button
            variant="outline"
            className="h-12 w-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            onClick={handleGoogleSignUp}
            disabled={loading}
          >
            {loading ? "Processing..." : "Continue with Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0f1a66] px-3 font-mono text-xs text-white/40">
                OR
              </span>
            </div>
          </div>

          <form className="space-y-3" onSubmit={handleRegister}>
            <Input
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="h-12 border-white/20 bg-white/5 text-white placeholder:text-white/40 focus:border-[#FF4D2E] focus:ring-[#FF4D2E]"
            />
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 border-white/20 bg-white/5 text-white placeholder:text-white/40 focus:border-[#FF4D2E] focus:ring-[#FF4D2E]"
            />

            {/* Password Input Wrapper */}
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 border-white/20 bg-white/5 pr-10 text-white placeholder:text-white/40 focus:border-[#FF4D2E] focus:ring-[#FF4D2E]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/80"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Confirm Password Input Wrapper */}
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 border-white/20 bg-white/5 pr-10 text-white placeholder:text-white/40 focus:border-[#FF4D2E] focus:ring-[#FF4D2E]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/80"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <Button
              className="h-12 w-full bg-[#FF4D2E] font-semibold text-white hover:bg-[#e04327]"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 space-y-4 text-center">
          <p className="text-sm text-white/60">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[#FF4D2E] transition-colors hover:text-[#FF4D2E]/80"
            >
              Sign In
            </Link>
          </p>

          <Link
            href="/"
            className="inline-block text-xs text-white/40 transition-colors hover:text-white/60"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
