import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "@/app/components/layout/sidebar";
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

const user = {
  id: "user-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  image: null,
};

describe("Sidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    usePathname.mockReturnValue("/study");
    useRouter.mockReturnValue({ push: jest.fn(), refresh: jest.fn() });
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
});
