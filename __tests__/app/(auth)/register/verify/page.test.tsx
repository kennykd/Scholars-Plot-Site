import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterVerifyPage from "@/app/(auth)/register/verify/page";
import { auth } from "@/lib/firebase/firebase";

import {
    applyActionCode,
    sendEmailVerification,
    onAuthStateChanged,
    deleteUser,
} from "firebase/auth";

import { toast } from "sonner";

const push = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push,
    }),
}));

jest.mock("@/lib/firebase/firebase", () => ({
    auth: {
        currentUser: null,
    },
}));

jest.mock("firebase/auth", () => ({
    applyActionCode: jest.fn(),
    sendEmailVerification: jest.fn(),
    onAuthStateChanged: jest.fn(),
    deleteUser: jest.fn(),
}));

jest.mock("sonner", () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
    },
}));

const mockFetch = jest.fn();

global.fetch = mockFetch as typeof fetch;
const mutableAuth = auth as unknown as { currentUser: unknown };

describe("RegisterVerifyPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockFetch.mockResolvedValue({
            ok: true,
        });

        Storage.prototype.getItem = jest.fn();
        Storage.prototype.removeItem = jest.fn();
    });

    it("shows verification screen after auth check completes", async () => {
        (localStorage.getItem as jest.Mock).mockReturnValue(
            "john@example.com"
        );

        (onAuthStateChanged as jest.Mock).mockImplementation(
            (_auth, callback) => {
                callback(null);
                return jest.fn();
            }
        );

        render(<RegisterVerifyPage />);

        expect(
            await screen.findByText(/check your inbox/i)
        ).toBeInTheDocument();

        expect(
            screen.getByText("john@example.com")
        ).toBeInTheDocument();
    });

    it("redirects verified users directly to dashboard", async () => {
        const reload = jest.fn();

        const user = {
            emailVerified: true,
            reload,
            getIdToken: jest.fn().mockResolvedValue("token123"),
        };

        (onAuthStateChanged as jest.Mock).mockImplementation(
            (_auth, callback) => {
                callback(user);
                return jest.fn();
            }
        );

        render(<RegisterVerifyPage />);

        await waitFor(() => {
            expect(push).toHaveBeenCalledWith("/dashboard");
        });

        expect(toast.success).toHaveBeenCalledWith(
            "Welcome back! You are already verified 🎉"
        );
    });

    it("resends verification email", async () => {
        const user = userEvent.setup();

        const currentUser = {
            uid: "user1",
        };

        mutableAuth.currentUser = currentUser;

        (onAuthStateChanged as jest.Mock).mockImplementation(
            (_auth, callback) => {
                callback(null);
                return jest.fn();
            }
        );

        render(<RegisterVerifyPage />);

        await screen.findByText(/check your inbox/i);

        await user.click(
            screen.getByRole("button", {
                name: /resend security link/i,
            })
        );

        await waitFor(() => {
            expect(
                sendEmailVerification
            ).toHaveBeenCalled();
        });

        expect(toast.success).toHaveBeenCalledWith(
            "A new verification link has been sent! 📧"
        );
    });

    it("redirects to register when resending without session", async () => {
        const user = userEvent.setup();

        mutableAuth.currentUser = null;

        (onAuthStateChanged as jest.Mock).mockImplementation(
            (_auth, callback) => {
                callback(null);
                return jest.fn();
            }
        );

        render(<RegisterVerifyPage />);

        await screen.findByText(/check your inbox/i);

        await user.click(
            screen.getByRole("button", {
                name: /resend security link/i,
            })
        );

        expect(toast.error).toHaveBeenCalledWith(
            "No active session found. Please sign in or register again."
        );

        expect(push).toHaveBeenCalledWith("/register");
    });

    it("deletes unverified account when changing email", async () => {
        const user = userEvent.setup();

        const currentUser = {
            emailVerified: false,
        };

        mutableAuth.currentUser = currentUser;

        (onAuthStateChanged as jest.Mock).mockImplementation(
            (_auth, callback) => {
                callback(null);
                return jest.fn();
            }
        );

        render(<RegisterVerifyPage />);

        await screen.findByText(/check your inbox/i);

        await user.click(
            screen.getByRole("button", {
                name: /wrong email address/i,
            })
        );

        await waitFor(() => {
            expect(deleteUser).toHaveBeenCalledWith(
                currentUser
            );
        });

        expect(push).toHaveBeenCalledWith("/register");

        expect(localStorage.removeItem).toHaveBeenCalledWith(
            "emailForVerification"
        );
    });

    it("redirects even if delete user fails", async () => {
        const user = userEvent.setup();

        const currentUser = {
            emailVerified: false,
        };

        mutableAuth.currentUser = currentUser;

        (deleteUser as jest.Mock).mockRejectedValue(
            new Error("Delete failed")
        );

        (onAuthStateChanged as jest.Mock).mockImplementation(
            (_auth, callback) => {
                callback(null);
                return jest.fn();
            }
        );

        render(<RegisterVerifyPage />);

        await screen.findByText(/check your inbox/i);

        await user.click(
            screen.getByRole("button", {
                name: /wrong email address/i,
            })
        );

        await waitFor(() => {
            expect(push).toHaveBeenCalledWith(
                "/register"
            );
        });
    });

    it("handles verification link failure", async () => {
        jest
            .spyOn(URLSearchParams.prototype, "get")
            .mockImplementation((key: string) => {
                if (key === "mode") return "verifyEmail";
                if (key === "oobCode") return "invalidCode";
                return null;
            });

        (applyActionCode as jest.Mock).mockRejectedValue(
            new Error("Invalid code")
        );

        (onAuthStateChanged as jest.Mock).mockImplementation(
            (_auth, callback) => {
                callback(null);
                return jest.fn();
            }
        );

        render(<RegisterVerifyPage />);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                "This verification link has expired or already been used."
            );
        });
    });
});
