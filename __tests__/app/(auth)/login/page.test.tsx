import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/(auth)/login/page";

import {
    signInWithPopup,
    signInWithEmailAndPassword,
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
    signInWithPopup: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
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

describe("LoginPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders login form", () => {
        render(<LoginPage />);

        expect(
            screen.getByText("Welcome back")
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText("Email address")
        ).toBeInTheDocument();

        expect(
            screen.getByPlaceholderText("Password (min 6 chars)")
        ).toBeInTheDocument();

        expect(
            screen.getByRole("button", {
                name: /continue with google/i,
            })
        ).toBeInTheDocument();

        expect(
            screen.getByRole("button", {
                name: /sign in/i,
            })
        ).toBeInTheDocument();
    });

    it("updates email and password fields", async () => {
        const user = userEvent.setup();

        render(<LoginPage />);

        const emailInput =
            screen.getByPlaceholderText("Email address");

        const passwordInput =
            screen.getByPlaceholderText(
                "Password (min 6 chars)"
            );

        await user.type(emailInput, "test@example.com");
        await user.type(passwordInput, "password123");

        expect(emailInput).toHaveValue(
            "test@example.com"
        );

        expect(passwordInput).toHaveValue(
            "password123"
        );
    });

    it("toggles password visibility", async () => {
        const user = userEvent.setup();

        render(<LoginPage />);

        const passwordInput =
            screen.getByPlaceholderText(
                "Password (min 6 chars)"
            );

        expect(passwordInput).toHaveAttribute(
            "type",
            "password"
        );

        await user.click(
            screen.getByRole("button", {
                name: /show password/i,
            })
        );

        expect(passwordInput).toHaveAttribute(
            "type",
            "text"
        );

        await user.click(
            screen.getByRole("button", {
                name: /hide password/i,
            })
        );

        expect(passwordInput).toHaveAttribute(
            "type",
            "password"
        );
    });

    it("logs in successfully with email/password", async () => {
        const user = userEvent.setup();

        mockFetch.mockResolvedValue({
            ok: true,
        });

        (signInWithEmailAndPassword as jest.Mock)
            .mockResolvedValue({
                user: {
                    getIdToken: jest
                        .fn()
                        .mockResolvedValue("token123"),
                },
            });

        render(<LoginPage />);

        await user.type(
            screen.getByPlaceholderText("Email address"),
            "test@example.com"
        );

        await user.type(
            screen.getByPlaceholderText(
                "Password (min 6 chars)"
            ),
            "password123"
        );

        await user.click(
            screen.getByRole("button", {
                name: /sign in/i,
            })
        );

        await waitFor(() => {
            expect(
                signInWithEmailAndPassword
            ).toHaveBeenCalled();
        });

        expect(mockFetch).toHaveBeenCalledWith(
            "/api/auth/firebase",
            expect.objectContaining({
                method: "POST",
            })
        );

        expect(toast.success).toHaveBeenCalledWith(
            "Login success!"
        );

        expect(push).toHaveBeenCalledWith(
            "/dashboard"
        );

        expect(refresh).toHaveBeenCalled();
    });

    it("shows firebase email login errors", async () => {
        const user = userEvent.setup();

        (signInWithEmailAndPassword as jest.Mock)
            .mockRejectedValue({
                code: "auth/wrong-password",
            });

        render(<LoginPage />);

        await user.type(
            screen.getByPlaceholderText("Email address"),
            "test@example.com"
        );

        await user.type(
            screen.getByPlaceholderText(
                "Password (min 6 chars)"
            ),
            "password123"
        );

        await user.click(
            screen.getByRole("button", {
                name: /sign in/i,
            })
        );

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                "Wrong password"
            );
        });
    });

    it("logs in successfully with Google", async () => {
        const user = userEvent.setup();

        mockFetch.mockResolvedValue({
            ok: true,
        });

        (signInWithPopup as jest.Mock).mockResolvedValue({
            user: {
                getIdToken: jest
                    .fn()
                    .mockResolvedValue("token123"),
            },
        });

        render(<LoginPage />);

        await user.click(
            screen.getByRole("button", {
                name: /continue with google/i,
            })
        );

        await waitFor(() => {
            expect(signInWithPopup).toHaveBeenCalled();
        });

        expect(toast.success).toHaveBeenCalledWith(
            "Login success!"
        );

        expect(push).toHaveBeenCalledWith(
            "/dashboard"
        );
    });

    it("handles cancelled Google login", async () => {
        const user = userEvent.setup();

        (signInWithPopup as jest.Mock).mockRejectedValue({
            code: "auth/popup-closed-by-user",
        });

        render(<LoginPage />);

        await user.click(
            screen.getByRole("button", {
                name: /continue with google/i,
            })
        );

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                "Google login cancelled"
            );
        });
    });

    it("shows generic Google login errors", async () => {
        const user = userEvent.setup();

        (signInWithPopup as jest.Mock).mockRejectedValue({
            message: "Something went wrong",
        });

        render(<LoginPage />);

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