import { render, screen } from "@testing-library/react";
import SettingsPage from "@/app/(app)/settings/page";
import { getSession } from "@/lib/firebase/auth";
import { getUserProfileForSession } from "@/lib/services/userService";
import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";

type Session = Awaited<ReturnType<typeof getSession>>;
type Profile = Awaited<ReturnType<typeof getUserProfileForSession>>;

jest.mock("@/lib/firebase/auth", () => ({
    getSession: jest.fn(),
}));

jest.mock("@/lib/services/userService", () => ({
    getUserProfileForSession: jest.fn(),
}));

jest.mock("next/navigation", () => ({
    redirect: jest.fn(() => {
        throw new Error("NEXT_REDIRECT");
    }),
}));

jest.mock("@/components/ui/card", () => ({
    Card: ({ children }: PropsWithChildren) => <div>{children}</div>,
    CardHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
    CardTitle: ({ children }: PropsWithChildren) => <div>{children}</div>,
    CardContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

jest.mock("@/app/components/settings/profile-display-name-form", () => ({
    ProfileDisplayNameForm: ({ user }: { user?: Profile }) => (
        <div data-testid="profile-form">{user?.name ?? "no-name"}</div>
    ),
}));

jest.mock("@/app/components/settings/theme-toggle", () => ({
    ThemeToggle: () => <div>Theme Toggle</div>,
}));

jest.mock("@/app/components/settings/push-notifications-toggle", () => {
    return function PushNotificationsToggle() {
        return <div>Push Notifications Toggle</div>;
    };
});

jest.mock("@/app/components/auth/logout-button", () => {
    return function LogoutButton() {
        return <button>Logout</button>;
    };
});

const mockedGetSession = jest.mocked(getSession);
const mockedGetProfile = jest.mocked(getUserProfileForSession);
const mockedRedirect = jest.mocked(redirect);

describe("SettingsPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("redirects to login when no session exists", async () => {
        mockedGetSession.mockResolvedValue(null);

        await expect(SettingsPage()).rejects.toThrow("NEXT_REDIRECT");

        expect(mockedRedirect).toHaveBeenCalledWith("/login");
        expect(mockedGetProfile).not.toHaveBeenCalled();
    });

    it("renders the settings sections for an authenticated user", async () => {
        mockedGetSession.mockResolvedValue({
            id: "user-1",
            name: "John Doe",
            email: "john@example.com",
            image: null,
        } satisfies Session);
        mockedGetProfile.mockResolvedValue({
            id: "user-1",
            name: "John Doe",
            email: "john@example.com",
            image: null,
        } satisfies Profile);

        const Page = await SettingsPage();
        render(Page);

        expect(screen.getByText("SETTINGS")).toBeInTheDocument();
        expect(screen.getByText("Theme Toggle")).toBeInTheDocument();
        expect(screen.getByText("Push Notifications Toggle")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /logout/i })
        ).toBeInTheDocument();
    });

    it("loads the profile from the database and passes it to the display-name form", async () => {
        mockedGetSession.mockResolvedValue({
            id: "user-1",
            name: "Session Name",
            email: "john@example.com",
            image: null,
        } satisfies Session);
        mockedGetProfile.mockResolvedValue({
            id: "user-1",
            name: "Stored Name",
            email: "john@example.com",
            image: null,
        } satisfies Profile);

        const Page = await SettingsPage();
        render(Page);

        expect(mockedGetProfile).toHaveBeenCalledWith(
            expect.objectContaining({ id: "user-1" })
        );
        // The form is rendered with the DB-backed profile, not the raw session.
        expect(screen.getByTestId("profile-form")).toHaveTextContent("Stored Name");
    });
});
