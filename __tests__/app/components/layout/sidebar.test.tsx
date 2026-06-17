import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "@/app/components/layout/sidebar";
import { signOut } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/lib/firebase/firebase", () => ({
  auth: {},
}));

jest.mock("firebase/auth", () => ({
  signOut: jest.fn(),
}));

// 2. Type-cast the mocked functions so TS knows they have Jest mock methods (.mockReturnValue, etc.)
const mockedUsePathname = usePathname as jest.Mock;
const mockedUseRouter = useRouter as jest.Mock;
const mockedSignOut = signOut as jest.Mock;

// 3. Define the User interface matching your Sidebar component props
interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

const user: User = {
  id: "user-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  image: null,
};

describe("Sidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Use the typed mock variables here
    mockedUsePathname.mockReturnValue("/study");
    mockedUseRouter.mockReturnValue({ push: jest.fn(), refresh: jest.fn() });

    // Mock global fetch safely for TS
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
    } as Response);

    mockedSignOut.mockResolvedValue(undefined);
  });

  it("keeps collapsed navigation accessible without showing hover popups", async () => {
    localStorage.setItem("sidebar-collapsed", "true");
    const userEventSetup = userEvent.setup();

    render(<Sidebar user={user} />);

    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");

    await userEventSetup.hover(dashboardLink);

    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("signs out of Firebase client auth when logging out", async () => {
    const userEventSetup = userEvent.setup();

    render(<Sidebar user={user} />);

    await userEventSetup.click(screen.getByRole("button", { name: /logout/i }));
    await userEventSetup.click(screen.getByRole("button", { name: /yes, logout/i }));

    await waitFor(() => {
      expect(mockedSignOut).toHaveBeenCalledWith({});
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
  });
});