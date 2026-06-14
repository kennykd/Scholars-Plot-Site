import { render, screen } from "@testing-library/react";
import SettingsPage from "@/app/(app)/settings/page";
import { getSession } from "@/lib/firebase/auth";
import { redirect } from "next/navigation";

jest.mock("@/lib/firebase/auth", () => ({
    getSession: jest.fn(),
}));

jest.mock("next/navigation", () => ({
    redirect: jest.fn(() => {
        throw new Error("NEXT_REDIRECT");
    }),
}));

jest.mock("@/components/ui/card", () => ({
    Card: ({ children }: any) => <div>{children}</div>,
    CardHeader: ({ children }: any) => <div>{children}</div>,
    CardTitle: ({ children }: any) => <div>{children}</div>,
    CardContent: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/components/ui/avatar", () => ({
    Avatar: ({ children }: any) => <div>{children}</div>,
    AvatarImage: ({ src, alt }: any) => (
        <img data-testid="avatar-image" src={src} alt={alt} />
    ),
    AvatarFallback: ({ children }: any) => (
        <div data-testid="avatar-fallback">{children}</div>
    ),
}));

jest.mock("@/app/components/auth/logout-button", () => {
    return function LogoutButton() {
        return <button>Logout</button>;
    };
});

jest.mock("@/app/components/settings/push-notifications-toggle", () => {
    return function PushNotificationsToggle() {
        return <div>Push Notifications Toggle</div>;
    };
});

jest.mock("@/app/components/settings/theme-toggle", () => ({
    ThemeToggle: () => <div>Theme Toggle</div>,
}));

const mockedGetSession = jest.mocked(getSession);
const mockedRedirect = jest.mocked(redirect);

describe("SettingsPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("redirects to login when no session exists", async () => {
        mockedGetSession.mockResolvedValue(null);

        await expect(SettingsPage()).rejects.toThrow(
            "NEXT_REDIRECT"
        );

        expect(mockedRedirect).toHaveBeenCalledWith("/login");
    });

    it("renders user profile information", async () => {
        mockedGetSession.mockResolvedValue({
            name: "John Doe",
            email: "john@example.com",
            image: "https://example.com/avatar.png",
        } as any);

        const Page = await SettingsPage();

        render(Page);

        expect(screen.getByText("SETTINGS")).toBeInTheDocument();
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("john@example.com")).toBeInTheDocument();

        expect(screen.getByTestId("avatar-image")).toHaveAttribute(
            "src",
            "https://example.com/avatar.png"
        );

        expect(screen.getByText("Theme Toggle")).toBeInTheDocument();

        expect(
            screen.getByText("Push Notifications Toggle")
        ).toBeInTheDocument();

        expect(
            screen.getByRole("button", { name: /logout/i })
        ).toBeInTheDocument();
    });

    it("uses email prefix when name is missing", async () => {
        mockedGetSession.mockResolvedValue({
            email: "jane@example.com",
            image: "",
        } as any);

        const Page = await SettingsPage();

        render(Page);

        expect(screen.getByText("jane")).toBeInTheDocument();

        expect(
            screen.getByTestId("avatar-fallback")
        ).toHaveTextContent("J");
    });

    it("uses initials from display name", async () => {
        mockedGetSession.mockResolvedValue({
            name: "John Doe",
            email: "john@example.com",
        } as any);

        const Page = await SettingsPage();

        render(Page);

        expect(
            screen.getByTestId("avatar-fallback")
        ).toHaveTextContent("JD");
    });

    it("falls back to User when name and email are unavailable", async () => {
        mockedGetSession.mockResolvedValue({
            name: undefined,
            email: undefined,
            image: undefined,
        } as any);

        const Page = await SettingsPage();

        render(Page);

        expect(screen.getByText("User")).toBeInTheDocument();

        expect(
            screen.getByTestId("avatar-fallback")
        ).toHaveTextContent("U");
    });

    it("does not use blank avatar image", async () => {
        mockedGetSession.mockResolvedValue({
            name: "John Doe",
            email: "john@example.com",
            image: "   ",
        } as any);

        const Page = await SettingsPage();

        render(Page);

        expect(screen.getByTestId("avatar-image")).not.toHaveAttribute(
            "src",
            "   "
        );
    });
});