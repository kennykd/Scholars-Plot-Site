"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

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
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const idToken = await result.user.getIdToken();
      await createSession(idToken, displayName);
      toast.success("Account created! Welcome 🎉");
      router.push("/dashboard");
      router.refresh();
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
    <div className="w-full max-w-md space-y-8">
      <div className="bg-[#0f1a66]/90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            SCHOLAR&apos;S PLOT
          </h1>
          <p className="font-mono text-xs tracking-[0.2em] text-white/60 mb-5">
            CREATE ACCOUNT
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <Button
            variant="outline"
            className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white h-12"
            onClick={handleGoogleSignUp}
            disabled={loading}
          >
            {loading ? "Processing..." : "Continue with Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="text-l px-3 text-white/40 font-mono">
                OR
              </span>
            </div>
          </div>

          <form className="space-y-3 mb-5" onSubmit={handleRegister}>
            <Input
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="bg-white/5 border-white/20 text-white placeholder:text-white/40 h-12 focus:border-[#FF4D2E] focus:ring-[#FF4D2E]"
            />
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/5 border-white/20 text-white placeholder:text-white/40 h-12 focus:border-[#FF4D2E] focus:ring-[#FF4D2E]"
            />

            {/* 3. Password Input Wrapper */}
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"} // Dynamic input type
                placeholder="Password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40 h-12 pr-10 focus:border-[#FF4D2E] focus:ring-[#FF4D2E]"
              />
              <button
                type="button" // CRITICAL: type="button" prevents form submission trigger
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* 4. Confirm Password Input Wrapper */}
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"} // Dynamic input type
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40 h-12 pr-10 focus:border-[#FF4D2E] focus:ring-[#FF4D2E]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <Button
              className="w-full bg-[#FF4D2E] hover:bg-[#e04327] text-white font-semibold h-12"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center space-y-4">
          <p className="text-sm text-white/60">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[#FF4D2E] hover:text-[#FF4D2E]/80 font-medium transition-colors"
            >
              Sign In
            </Link>
          </p>

          <Link
            href="/"
            className="text-l text-white/40 hover:text-white/60 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
