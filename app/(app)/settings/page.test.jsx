import { render, screen } from "@testing-library/react";
import SettingsPage from "./page";
import { getSession } from "@/lib/firebase/auth";
import { redirect } from "next/navigation";

jest.mock("@/lib/firebase/auth", () => ({
	getSession: jest.fn(),
}));

jest.mock("next/navigation", () => ({
	redirect: jest.fn(),
}));

jest.mock("@/app/components/auth/logout-button", () => () => (
	<button type="button">Mock Logout</button>
));

jest.mock("../../components/settings/theme-toggle", () => ({
	ThemeToggle: () => <div>Mock Theme Toggle</div>,
}));

describe("SettingsPage", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("redirects to login when there is no active session", async () => {
		getSession.mockResolvedValue(null);

		await SettingsPage();

		expect(redirect).toHaveBeenCalledWith("/login");
	});

	it("renders user profile, appearance section, and logout when session exists", async () => {
		getSession.mockResolvedValue({
			name: "Kenny Dev",
			email: "kenny@example.com",
			image: "https://example.com/avatar.png",
		});

		const ui = await SettingsPage();
		render(ui);

		expect(screen.getByText("SETTINGS")).toBeInTheDocument();
		expect(screen.getByText("PREFERENCES & PROFILE")).toBeInTheDocument();
		expect(screen.getByText("Profile")).toBeInTheDocument();
		expect(screen.getByText("Appearance")).toBeInTheDocument();
		expect(screen.getByText("Kenny Dev")).toBeInTheDocument();
		expect(screen.getByText("kenny@example.com")).toBeInTheDocument();
		expect(screen.getByText("Mock Theme Toggle")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /mock logout/i })).toBeInTheDocument();
		expect(screen.getByText("KD")).toBeInTheDocument();
	});

	it("uses email prefix and initials fallback when name is missing", async () => {
		getSession.mockResolvedValue({
			name: null,
			email: "scholar.plot@example.com",
			image: "",
		});

		const ui = await SettingsPage();
		render(ui);

		expect(screen.getByText("scholar.plot")).toBeInTheDocument();
		expect(screen.getByText("S")).toBeInTheDocument();
	});
});
