import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LogoutButton from "@/app/components/auth/logout-button";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/lib/firebase/firebase", () => ({
  auth: {},
}));

jest.mock("firebase/auth", () => ({
  signOut: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("LogoutButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    (signOut as jest.Mock).mockResolvedValue(undefined);
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      refresh: jest.fn(),
    });
  });

  it("signs out of Firebase client auth when logging out", async () => {
    const user = userEvent.setup();

    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: /^logout$/i }));
    await user.click(screen.getByRole("button", { name: /yes, logout/i }));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({});
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
  });
});
