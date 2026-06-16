import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterPage from "@/app/(auth)/register/page";

import {
    createUserWithEmailAndPassword,
    signInWithPopup,
    sendEmailVerification,
} from "firebase/auth";

import { toast } from "sonner";

const push = jest.fn();
const refresh = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push,
        refresh,
    }),
}));

jest.mock("@/lib/firebase/firebase", () => ({
    auth: {},
}));

jest.mock("firebase/auth", () => ({
    createUserWithEmailAndPassword: jest.fn(),
    signInWithPopup: jest.fn(),
    sendEmailVerification: jest.fn(),
    GoogleAuthProvider: jest.fn(() => ({
        setCustomParameters: jest.fn(),
    })),
}));

jest.mock("sonner", () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock("next/link", () => {
    return function MockLink({
        children,
        href,
    }: {
        children: React.ReactNode;
        href: string;
    }) {
        return <a href={href}>{children}</a>;
    };
});

const mockFetch = jest.fn();

global.fetch = mockFetch as typeof fetch;

describe("RegisterPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        Storage.prototype.setItem = jest.fn();

        mockFetch.mockResolvedValue({
            ok: true,
        });
    });

    it("renders registration form", () => {
        render(<RegisterPage />);

        expect(
            screen.getByPlaceholderText("Display Name")
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText("Email address")
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText("Password (min 6 chars)")
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText("Confirm Password")
        ).toBeInTheDocument();
    });

    it("updates form fields", async () => {
        const user = userEvent.setup();

        render(<RegisterPage />);

        await user.type(
            screen.getByPlaceholderText("Display Name"),
            "John Doe"
        );

        await user.type(
            screen.getByPlaceholderText("Email address"),
            "john@example.com"
        );

        expect(
            screen.getByPlaceholderText("Display Name")
        ).toHaveValue("John Doe");

        expect(
            screen.getByPlaceholderText("Email address")
        ).toHaveValue("john@example.com");
    });

    it("toggles password visibility", async () => {
        const user = userEvent.setup();

        render(<RegisterPage />);

        const passwordInput =
            screen.getByPlaceholderText(
                "Password (min 6 chars)"
            );

        expect(passwordInput).toHaveAttribute(
            "type",
            "password"
        );

        await user.click(
            screen.getAllByRole("button", {
                name: /show password/i,
            })[0]
        );

        expect(passwordInput).toHaveAttribute(
            "type",
            "text"
        );
    });

    it("shows error when passwords do not match", async () => {
        const user = userEvent.setup();

        render(<RegisterPage />);

        await user.type(
            screen.getByPlaceholderText("Display Name"),
            "John"
        );

        await user.type(
            screen.getByPlaceholderText("Email address"),
            "john@example.com"
        );

        await user.type(
            screen.getByPlaceholderText(
                "Password (min 6 chars)"
            ),
            "password123"
        );

        await user.type(
            screen.getByPlaceholderText("Confirm Password"),
            "different123"
        );

        await user.click(
            screen.getByRole("button", {
                name: /create account/i,
            })
        );

        expect(toast.error).toHaveBeenCalledWith(
            "Passwords do not match"
        );

        expect(
            createUserWithEmailAndPassword
        ).not.toHaveBeenCalled();
    });

    it("registers successfully with email/password", async () => {
        const user = userEvent.setup();

        const firebaseUser = {
            uid: "user-1",
        };

        (createUserWithEmailAndPassword as jest.Mock)
            .mockResolvedValue({
                user: firebaseUser,
            });

        (sendEmailVerification as jest.Mock)
            .mockResolvedValue(undefined);

        render(<RegisterPage />);

        await user.type(
            screen.getByPlaceholderText("Display Name"),
            "John Doe"
        );

        await user.type(
            screen.getByPlaceholderText("Email address"),
            "john@example.com"
        );

        await user.type(
            screen.getByPlaceholderText(
                "Password (min 6 chars)"
            ),
            "password123"
        );

        await user.type(
            screen.getByPlaceholderText("Confirm Password"),
            "password123"
        );

        await user.click(
            screen.getByRole("button", {
                name: /create account/i,
            })
        );

        await waitFor(() => {
            expect(
                createUserWithEmailAndPassword
            ).toHaveBeenCalled();
        });

        expect(
            sendEmailVerification
        ).toHaveBeenCalledWith(
            firebaseUser,
            expect.objectContaining({
                handleCodeInApp: true,
            })
        );

        expect(localStorage.setItem).toHaveBeenCalledWith(
            "emailForVerification",
            "john@example.com"
        );

        expect(toast.success).toHaveBeenCalledWith(
            "Verification link sent! Please check your email."
        );

        expect(push).toHaveBeenCalledWith(
            "/register/verify"
        );
    });

    it("handles email already in use", async () => {
        const user = userEvent.setup();

        (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue({
            code: "auth/email-already-in-use",
        });

        render(<RegisterPage />);

        await user.type(
            screen.getByPlaceholderText("Display Name"),
            "John Doe"
        );

        await user.type(
            screen.getByPlaceholderText("Email address"),
            "john@example.com"
        );

        await user.type(
            screen.getByPlaceholderText("Password (min 6 chars)"),
            "password123"
        );

        await user.type(
            screen.getByPlaceholderText("Confirm Password"),
            "password123"
        );

        await user.click(
            screen.getByRole("button", {
                name: /create account/i,
            })
        );

        await waitFor(() => {
            expect(
                createUserWithEmailAndPassword
            ).toHaveBeenCalled();
        });

        expect(toast.error).toHaveBeenCalledWith(
            "Email already in use"
        );
    });

    it("handles weak password error", async () => {
        const user = userEvent.setup();

        (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue({
            code: "auth/weak-password",
        });

        render(<RegisterPage />);

        await user.type(
            screen.getByPlaceholderText("Display Name"),
            "John Doe"
        );

        await user.type(
            screen.getByPlaceholderText("Email address"),
            "john@example.com"
        );

        await user.type(
            screen.getByPlaceholderText("Password (min 6 chars)"),
            "password123"
        );

        await user.type(
            screen.getByPlaceholderText("Confirm Password"),
            "password123"
        );

        await user.click(
            screen.getByRole("button", {
                name: /create account/i,
            })
        );

        await waitFor(() => {
            expect(
                createUserWithEmailAndPassword
            ).toHaveBeenCalled();
        });

        expect(toast.error).toHaveBeenCalledWith(
            "Password too weak (min 6 chars)"
        );
    });

    it("registers successfully with Google", async () => {
        const user = userEvent.setup();

        mockFetch.mockResolvedValue({ ok: true });

        (signInWithPopup as jest.Mock).mockResolvedValue({
            user: {
                getIdToken: jest
                    .fn()
                    .mockResolvedValue("token123"),
            },
        });

        render(<RegisterPage />);

        await user.click(
            screen.getByRole("button", {
                name: /continue with google/i,
            })
        );

        await waitFor(() => {
            expect(signInWithPopup).toHaveBeenCalled();
        });

        expect(mockFetch).toHaveBeenCalled();

        expect(toast.success).toHaveBeenCalledWith(
            "Account created! Welcome 🎉"
        );

        expect(push).toHaveBeenCalledWith(
            "/dashboard"
        );

        expect(refresh).toHaveBeenCalled();
    });

    it("handles cancelled Google sign up", async () => {
        const user = userEvent.setup();

        (signInWithPopup as jest.Mock)
            .mockRejectedValue({
                code: "auth/popup-closed-by-user",
            });

        render(<RegisterPage />);

        await user.click(
            screen.getByRole("button", {
                name: /continue with google/i,
            })
        );

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                "Google sign-up cancelled"
            );
        });
    });

    it("handles generic Google errors", async () => {
        const user = userEvent.setup();

        (signInWithPopup as jest.Mock)
            .mockRejectedValue({
                message: "Something went wrong",
            });

        render(<RegisterPage />);

        await user.click(
            screen.getByRole("button", {
                name: /continue with google/i,
            })
        );

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                "Something went wrong"
            );
        });
    });
});