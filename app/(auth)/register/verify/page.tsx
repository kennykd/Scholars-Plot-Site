"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/firebase";
import { applyActionCode, sendEmailVerification, onAuthStateChanged, deleteUser } from "firebase/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MailCheck } from "lucide-react";

export default function RegisterVerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isProcessingLink, setIsProcessingLink] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const createSession = async (idToken: string) => {
    const res = await fetch("/api/auth/firebase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!res.ok) throw new Error("Failed to create session");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await user.reload(); 
        
        if (user.emailVerified) {
          const idToken = await user.getIdToken(true);
          await createSession(idToken);
          window.localStorage.removeItem("emailForVerification");
          toast.success("Welcome back! You are already verified 🎉");
          router.push("/dashboard");
          return;
        }
      }

      const savedEmail = window.localStorage.getItem("emailForVerification");
      setEmail(savedEmail);

      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get("mode");
      const actionCode = urlParams.get("oobCode");

      if (mode === "verifyEmail" && actionCode) {
        setIsProcessingLink(true);

        try {
          await applyActionCode(auth, actionCode);
          
          if (auth.currentUser) {
            await auth.currentUser.reload();
            const idToken = await auth.currentUser.getIdToken(true);
            await createSession(idToken);
          }
          
          window.localStorage.removeItem("emailForVerification");
          toast.success("Email successfully verified! Welcome 🎉");
          router.push("/dashboard");
        } catch (error) {
          console.error(error);
          toast.error("This verification link has expired or already been used.");
          setIsProcessingLink(false);
        }
      } else {
        setIsProcessingLink(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleResendLink = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      toast.error("No active session found. Please sign in or register again.");
      router.push("/register");
      return;
    }

    try {
      setIsResending(true);
      const actionCodeSettings = {
        url: "http://localhost:3000/register/verify",
        handleCodeInApp: true,
      };

      await sendEmailVerification(currentUser, actionCodeSettings);
      toast.success("A new verification link has been sent! 📧");
    } catch (error) {
      console.error(error);
      toast.error("Failed to send verification email. Try again later.");
    } finally {
      setIsResending(false);
    }
  };

  // Deletes the unverified user instance so the email can be re-used
  const handleChangeEmail = async () => {
    const currentUser = auth.currentUser;
    
    try {
      setIsDeleting(true);
      window.localStorage.removeItem("emailForVerification");

      if (currentUser && !currentUser.emailVerified) {
        await deleteUser(currentUser);
      }
      
      router.push("/register");
    } catch (error) {
      console.error(error);
      // Fallback redirect if token expired or session dropped
      router.push("/register");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isProcessingLink) {
    return (
      <div className="min-h-screen w-full max-w-md mx-auto flex flex-col justify-center space-y-8 px-4 py-12">
        <div className="bg-[#0f1a66]/90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl text-center min-h-87.5 flex flex-col justify-center items-center border border-white/10">
          <p className="font-mono text-sm tracking-widest animate-pulse text-[#FF4D2E]">
            INITIALIZING VERIFICATION PROCESS...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center w-full max-w-md mx-auto space-y-8">
      <div className="bg-[#0f1a66]/90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10">
        
        <div className="text-center space-y-2 mb-8">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            SCHOLAR&apos;S PLOT <span className="text-[#FF4D2E]">SITE</span>
          </h1>
          <p className="font-mono text-xs tracking-[0.2em] text-white/60">
            PENDING VERIFICATION
          </p>
        </div>

        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="p-4 bg-white/5 rounded-full border border-white/10 text-[#FF4D2E]">
            <MailCheck size={40} className="animate-pulse" />
          </div>
          <h2 className="font-mono text-lg font-bold text-white tracking-wide">
            CHECK YOUR INBOX
          </h2>
          <p className="text-sm text-white/70 leading-relaxed">
            We sent you a verification link to:{" "}
            <span className="block font-mono text-sm text-[#FF4D2E] bg-black/30 py-1.5 px-3 rounded-md mt-2 border border-white/5 break-all">
              {email || "your_registered_email@domain.com"}
            </span>
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <Button
            onClick={handleResendLink}
            disabled={isResending || isDeleting}
            className="w-full bg-[#FF4D2E] hover:bg-[#e04327] text-white font-mono font-bold uppercase tracking-wider h-12 border-b-4 border-[#b8321a] active:border-b-0 transition-all"
          >
            {isResending ? "TRANSMITTING..." : "Resend Security Link"}
          </Button>
        </div>

        <div className="text-center space-y-4 pt-4 border-t border-white/10">
          <button
            onClick={handleChangeEmail}
            disabled={isDeleting}
            className="text-sm font-mono text-white/50 hover:text-[#FF4D2E] tracking-tight transition-colors underline bg-transparent border-none cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? "RESETTING EMAIL..." : "Wrong email address? Click here to change it!"}
          </button>
        </div>

      </div>
    </div>
  );
}