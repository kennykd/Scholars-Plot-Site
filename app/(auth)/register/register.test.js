import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterPage from "./page";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Mocks
jest.mock("next/navigation");
jest.mock("@/lib/firebase/firebase", () => ({
  auth: {},
}));
jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: jest.fn(),
}));
jest.mock("sonner");
global.fetch = jest.fn();

describe("RegisterPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useRouter.mockReturnValue({
      push: jest.fn(),
      refresh: jest.fn(),
    });
  });

  it("should render all form elements", () => {
    render(<RegisterPage />);

    expect(screen.getByPlaceholderText("Display Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email address")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Password (min 6 chars)"),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirm Password")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();

    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it("should register successfully with email and password", async () => {
    const user = userEvent.setup();

    const mockUser = {
      getIdToken: jest.fn().mockResolvedValue("fake-token"),
    };
    createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });

    global.fetch.mockResolvedValue({ ok: true });

    const mockPush = jest.fn();
    const mockRefresh = jest.fn();
    useRouter.mockReturnValue({ push: mockPush, refresh: mockRefresh });

    render(<RegisterPage />);

    await user.type(screen.getByPlaceholderText("Display Name"), "John Doe");
    await user.type(
      screen.getByPlaceholderText("Email address"),
      "john@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("Password (min 6 chars)"),
      "password123",
    );
    await user.type(
      screen.getByPlaceholderText("Confirm Password"),
      "password123",
    );

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        "john@example.com",
        "password123",
      );
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/auth/firebase", {
      method: "POST",
      headers: { Authorization: "Bearer fake-token" },
      body: JSON.stringify({ displayName: "John Doe" }),
    });

    expect(toast.success).toHaveBeenCalledWith("Account created! Welcome 🎉");
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("should show error when passwords do not match", async () => {
    const user = userEvent.setup();

    render(<RegisterPage />);

    await user.type(screen.getByPlaceholderText("Display Name"), "John Doe");
    await user.type(
      screen.getByPlaceholderText("Email address"),
      "john@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("Password (min 6 chars)"),
      "password123",
    );
    await user.type(
      screen.getByPlaceholderText("Confirm Password"),
      "password456",
    );

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Passwords do not match");
    });

    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("should show error for email already in use", async () => {
    const user = userEvent.setup();

    createUserWithEmailAndPassword.mockRejectedValue({
      code: "auth/email-already-in-use",
    });

    render(<RegisterPage />);

    await user.type(screen.getByPlaceholderText("Display Name"), "John Doe");
    await user.type(
      screen.getByPlaceholderText("Email address"),
      "existing@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("Password (min 6 chars)"),
      "password123",
    );
    await user.type(
      screen.getByPlaceholderText("Confirm Password"),
      "password123",
    );

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Email already in use");
    });
  });

  it("should show error for weak password", async () => {
    const user = userEvent.setup();

    createUserWithEmailAndPassword.mockRejectedValue({
      code: "auth/weak-password",
    });

    render(<RegisterPage />);

    await user.type(screen.getByPlaceholderText("Display Name"), "John Doe");
    await user.type(
      screen.getByPlaceholderText("Email address"),
      "john@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("Password (min 6 chars)"),
      "password123",
    );
    await user.type(
      screen.getByPlaceholderText("Confirm Password"),
      "password123",
    );

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Password too weak (min 6 chars)",
      );
    });
  });

  it("should show error for invalid email format", async () => {
    const user = userEvent.setup();

    createUserWithEmailAndPassword.mockRejectedValue({
      code: "auth/invalid-email",
    });

    render(<RegisterPage />);

    await user.type(screen.getByPlaceholderText("Display Name"), "John Doe");
    await user.type(
      screen.getByPlaceholderText("Email address"),
      "invalid@email.com", // Use a valid format so the form submits
    );
    await user.type(
      screen.getByPlaceholderText("Password (min 6 chars)"),
      "password123",
    );
    await user.type(
      screen.getByPlaceholderText("Confirm Password"),
      "password123",
    );

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid email format");
    });
  });

  it("should show generic error for unknown errors", async () => {
    const user = userEvent.setup();

    createUserWithEmailAndPassword.mockRejectedValue({
      code: "auth/unknown-error",
    });

    render(<RegisterPage />);

    await user.type(screen.getByPlaceholderText("Display Name"), "John Doe");
    await user.type(
      screen.getByPlaceholderText("Email address"),
      "john@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("Password (min 6 chars)"),
      "password123",
    );
    await user.type(
      screen.getByPlaceholderText("Confirm Password"),
      "password123",
    );

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Registration failed");
    });
  });

  it("should handle session creation failure", async () => {
    const user = userEvent.setup();

    const mockUser = {
      getIdToken: jest.fn().mockResolvedValue("fake-token"),
    };
    createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });

    global.fetch.mockResolvedValue({ ok: false });

    render(<RegisterPage />);

    await user.type(screen.getByPlaceholderText("Display Name"), "John Doe");
    await user.type(
      screen.getByPlaceholderText("Email address"),
      "john@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("Password (min 6 chars)"),
      "password123",
    );
    await user.type(
      screen.getByPlaceholderText("Confirm Password"),
      "password123",
    );

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Registration failed");
    });
  });

  it("should register successfully with Google", async () => {
    const user = userEvent.setup();

    const mockUser = {
      getIdToken: jest.fn().mockResolvedValue("fake-google-token"),
    };
    signInWithPopup.mockResolvedValue({ user: mockUser });

    global.fetch.mockResolvedValue({ ok: true });

    const mockPush = jest.fn();
    const mockRefresh = jest.fn();
    useRouter.mockReturnValue({ push: mockPush, refresh: mockRefresh });

    render(<RegisterPage />);

    await user.type(screen.getByPlaceholderText("Display Name"), "Jane Doe");

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(signInWithPopup).toHaveBeenCalled();
    });

    expect(toast.success).toHaveBeenCalledWith("Account created! Welcome 🎉");
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("should handle Google popup cancellation", async () => {
    const user = userEvent.setup();

    signInWithPopup.mockRejectedValue({
      code: "auth/popup-closed-by-user",
    });

    render(<RegisterPage />);

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Google sign-up cancelled");
    });
  });

  it("should handle Google sign-up errors", async () => {
    const user = userEvent.setup();

    signInWithPopup.mockRejectedValue({
      message: "Google auth failed",
    });

    render(<RegisterPage />);

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Google auth failed");
    });
  });

  it("should show loading state during email registration", async () => {
    const user = userEvent.setup();

    createUserWithEmailAndPassword.mockImplementation(
      () => new Promise(() => {}),
    );

    render(<RegisterPage />);

    await user.type(screen.getByPlaceholderText("Display Name"), "John Doe");
    await user.type(
      screen.getByPlaceholderText("Email address"),
      "john@example.com",
    );
    await user.type(
      screen.getByPlaceholderText("Password (min 6 chars)"),
      "password123",
    );
    await user.type(
      screen.getByPlaceholderText("Confirm Password"),
      "password123",
    );

    const createButton = screen.getByRole("button", {
      name: /create account/i,
    });
    const googleButton = screen.getByRole("button", {
      name: /continue with google/i,
    });

    await user.click(createButton);

    await waitFor(() => {
      expect(createButton).toBeDisabled();
      expect(googleButton).toBeDisabled();
      expect(screen.getByText("Creating account...")).toBeInTheDocument();
    });
  });

  it("should show loading state during Google sign-up", async () => {
    const user = userEvent.setup();

    signInWithPopup.mockImplementation(() => new Promise(() => {}));

    render(<RegisterPage />);

    const createButton = screen.getByRole("button", {
      name: /create account/i,
    });
    const googleButton = screen.getByRole("button", {
      name: /continue with google/i,
    });

    await user.click(googleButton);

    await waitFor(() => {
      expect(createButton).toBeDisabled();
      expect(googleButton).toBeDisabled();
      expect(screen.getByText("Processing...")).toBeInTheDocument();
    });
  });
});
