import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeToggle } from "./theme-toggle";
import { useTheme } from "next-themes";

jest.mock("next-themes", () => ({
	useTheme: jest.fn(),
}));

describe("ThemeToggle", () => {
	const mockUseTheme = useTheme;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("renders light mode state by default", () => {
		const setTheme = jest.fn();
		mockUseTheme.mockReturnValue({
			theme: "light",
			setTheme,
		});

		render(<ThemeToggle />);

		expect(screen.getByText("Theme")).toBeInTheDocument();
		expect(screen.getByText("Light Mode")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /toggle dark mode/i }),
		).toHaveAttribute("aria-pressed", "false");
	});

	it("renders dark mode state and can switch to light", () => {
		const setTheme = jest.fn();
		mockUseTheme.mockReturnValue({
			theme: "dark",
			setTheme,
		});

		render(<ThemeToggle />);

		expect(screen.getByText("Blueprint (Dark)")).toBeInTheDocument();

		const toggleButton = screen.getByRole("button", {
			name: /toggle dark mode/i,
		});
		expect(toggleButton).toHaveAttribute("aria-pressed", "true");

		fireEvent.click(toggleButton);
		expect(setTheme).toHaveBeenCalledWith("light");
	});

	it("switches from light to dark when clicked", () => {
		const setTheme = jest.fn();
		mockUseTheme.mockReturnValue({
			theme: "light",
			setTheme,
		});

		render(<ThemeToggle />);

		const toggleButton = screen.getByRole("button", {
			name: /toggle dark mode/i,
		});

		fireEvent.click(toggleButton);
		expect(setTheme).toHaveBeenCalledWith("dark");
	});
});
