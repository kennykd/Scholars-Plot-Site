import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProfileDisplayNameForm } from "@/app/components/settings/profile-display-name-form";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("ProfileDisplayNameForm", () => {
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ refresh });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    Reflect.deleteProperty(global, "fetch");
  });

  it("renders the current app display name and disables save until it changes", () => {
    render(
      <ProfileDisplayNameForm
        user={{
          name: "Ada Lovelace",
          email: "ada@example.com",
          image: null,
        }}
      />,
    );

    expect(screen.getByRole("textbox", { name: /display name/i })).toHaveValue(
      "Ada Lovelace",
    );
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save name/i })).toBeDisabled();
  });

  it("keeps save disabled for a blank display name", async () => {
    const user = userEvent.setup();
    render(
      <ProfileDisplayNameForm
        user={{
          name: "Ada Lovelace",
          email: "ada@example.com",
          image: null,
        }}
      />,
    );

    const input = screen.getByRole("textbox", { name: /display name/i });
    await user.clear(input);
    await user.type(input, "   ");

    expect(screen.getByRole("button", { name: /save name/i })).toBeDisabled();
  });

  it("saves a changed display name and refreshes server-rendered profile UI", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: "user-1",
          email: "ada@example.com",
          name: "Grace Hopper",
          image: null,
        },
      }),
    });

    render(
      <ProfileDisplayNameForm
        user={{
          name: "Ada Lovelace",
          email: "ada@example.com",
          image: null,
        }}
      />,
    );

    const input = screen.getByRole("textbox", { name: /display name/i });
    await user.clear(input);
    await user.type(input, "Grace Hopper");
    await user.click(screen.getByRole("button", { name: /save name/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/users/me",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ name: "Grace Hopper" }),
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith("Display name updated");
    expect(refresh).toHaveBeenCalled();
  });
});
