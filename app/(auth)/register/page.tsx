"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase/firebase";
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const createSession = async (idToken: string) => {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error("Failed to create session");
  };

  const handleGoogleSignUp = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await createSession(idToken);
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
      const idToken = await result.user.getIdToken();
      await createSession(idToken);
      toast.success("Account created! Welcome 🎉");
      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      let message = "Registration failed";
      if (err?.code === "auth/email-already-in-use") message = "Email already in use";
      else if (err?.code === "auth/weak-password") message = "Password too weak (min 6 chars)";
      else if (err?.code === "auth/invalid-email") message = "Invalid email format";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground">
          SCHOLAR&apos;S PLOT
        </h1>
        <p className="font-mono text-xs tracking-widest text-accent mt-1">V1.0 — CREATE ACCOUNT</p>
      </div>

      <Card className="border border-accent/30 bg-card/80 backdrop-blur-sm shadow-2xl">
        <CardHeader className="border-t-2 border-accent rounded-t-xl pb-2">
          <h2 className="font-display text-xl font-bold text-center text-foreground">
            Create Account
          </h2>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <Button
            variant="outline"
            className="w-full border-border hover:border-accent hover:text-accent transition-colors"
            onClick={handleGoogleSignUp}
            disabled={loading}
          >
            {loading ? "Processing..." : "Continue with Google"}
          </Button>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="font-mono text-xs text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          <form className="space-y-3" onSubmit={handleRegister}>
            <Input
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <Input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
            <Button
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Register"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline font-medium">
              Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
