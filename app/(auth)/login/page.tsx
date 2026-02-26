"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase/firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const createSession = async (idToken: string) => {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to create session");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      await createSession(idToken);

      toast.success("Login success 🎉");

      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      console.error(error);

      // If the firebase auth popup is closed by the user, cancel the login
      if ((error as {code?: string})?.code === "auth/popup-closed-by-user") {
        toast.error("Google login cancelled");
        return;
      }
      const err = error as {message?: string};
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    try {
      setLoading(true);

      const result = await signInWithEmailAndPassword(auth, email, password);

      const idToken = await result.user.getIdToken();
      await createSession(idToken);

      toast.success("Login success");

      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      console.error(error);

      let message = "Login failed";

      const err = error as {code?: string; message?: string};
      if (err.code === "auth/user-not-found") {
        message = "User not found";
      } else if (err.code === "auth/wrong-password") {
        message = "wrong password";
      } else if (err.code === "auth/invalid-email") {
        message = "invalid email format";
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Solid background card */}
      <div className="bg-[#0f1a66]/90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            SCHOLAR&apos;S PLOT
          </h1>
          <p className="font-mono text-xs tracking-[0.2em] text-white/60">
            V1.0 — STUDENT PLANNER
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <Button
            variant="outline"
            className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white h-12"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? "Processing..." : "Continue with Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#0f1a66] px-2 text-white/40 font-mono">OR</span>
            </div>
          </div>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleEmailLogin();
            }}
          >
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border-white/20 text-white placeholder:text-white/40 h-12 focus:border-[#FF4D2E] focus:ring-[#FF4D2E]"
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/5 border-white/20 text-white placeholder:text-white/40 h-12 focus:border-[#FF4D2E] focus:ring-[#FF4D2E]"
            />

            <Button
              className="w-full bg-[#FF4D2E] hover:bg-[#e04327] text-white font-semibold h-12"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center space-y-4 mt-8">
          <p className="text-sm text-white/60">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[#FF4D2E] hover:text-[#FF4D2E]/80 font-medium transition-colors">
              Register
            </Link>
          </p>
          
          <Link 
            href="/" 
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
