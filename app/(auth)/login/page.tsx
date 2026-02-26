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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

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
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground">
          SCHOLAR&apos;S PLOT
        </h1>
        <p className="font-mono text-xs tracking-widest text-accent mt-1">V1.0 — STUDENT PLANNER</p>
      </div>

      <Card className="border border-accent/30 bg-card/80 backdrop-blur-sm shadow-2xl">
        <CardHeader className="border-t-2 border-accent rounded-t-xl pb-2">
          <CardTitle className="font-display text-xl font-bold text-center text-foreground">
            Sign In
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <Button
            variant="outline"
            className="w-full border-border hover:border-accent hover:text-accent transition-colors"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? "Processing..." : "Continue with Google"}
          </Button>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="font-mono text-xs text-muted-foreground">OR</span>
            <Separator className="flex-1" />
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
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <a href="/register" className="text-accent hover:underline font-medium">
              Register
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
