import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";
import { signInWithEmailAndPassword } from "firebase/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Mocks
jest.mock("next/navigation");
jest.mock("@/lib/firebase/firebase", () => ({
  auth: {},
}));
jest.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: jest.fn(),
}));
jest.mock("sonner");
global.fetch = jest.fn();

describe("LoginPage", () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup router mock
    useRouter.mockReturnValue({
      push: jest.fn(),
      refresh: jest.fn(),
    });
  });

  it("should render all form elements", () => {
    render(<LoginPage />);

    // Check for inputs
    expect(screen.getByPlaceholderText("Email address")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();

    // Check for buttons
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();

    // Check for links
    expect(screen.getByText(/register/i)).toBeInTheDocument();
  });

  it("should login successfully with email and password", async () => {
    const user = userEvent.setup();

    // Mock successful Firebase login
    const mockUser = {
      getIdToken: jest.fn().mockResolvedValue("fake-token"),
    };
    signInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

    // Mock successful session creation
    global.fetch.mockResolvedValue({ ok: true });

    const mockPush = jest.fn();
    const mockRefresh = jest.fn();
    useRouter.mockReturnValue({ push: mockPush, refresh: mockRefresh });

    render(<LoginPage />);

    // Fill out form
    await user.type(
      screen.getByPlaceholderText("Email address"),
      "test@example.com",
    );
    await user.type(screen.getByPlaceholderText("Password"), "password123");

    // Submit
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Wait for async actions
    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        "test@example.com",
        "password123",
      );
    });

    // Check success flow
    expect(toast.success).toHaveBeenCalledWith("Login success");
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("should show error for wrong password", async () => {
    const user = userEvent.setup();

    // Mock Firebase error
    signInWithEmailAndPassword.mockRejectedValue({
      code: "auth/wrong-password",
    });

    render(<LoginPage />);

    await user.type(
      screen.getByPlaceholderText("Email address"),
      "test@example.com",
    );
    await user.type(screen.getByPlaceholderText("Password"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Wrong password");
    });
  });

  it("should show error for user not found", async () => {
    const user = userEvent.setup();

    signInWithEmailAndPassword.mockRejectedValue({
      code: "auth/user-not-found",
    });

    render(<LoginPage />);

    await user.type(
      screen.getByPlaceholderText("Email address"),
      "test@example.com",
    );
    await user.type(screen.getByPlaceholderText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("User not found");
    });
  });
});
