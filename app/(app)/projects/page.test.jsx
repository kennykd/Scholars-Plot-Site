import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectsPage from "./page";

jest.mock("@/components/ui/select", () => {
	const React = require("react");
	const SelectContext = React.createContext(null);

	const Select = ({ onValueChange, children }) => (
		<SelectContext.Provider value={onValueChange}>
			<div>{children}</div>
		</SelectContext.Provider>
	);

	const SelectTrigger = ({ children }) => <div>{children}</div>;
	const SelectValue = ({ placeholder }) => <span>{placeholder ?? ""}</span>;
	const SelectContent = ({ children }) => <div>{children}</div>;
	const SelectItem = ({ value, children }) => {
		const onValueChange = React.useContext(SelectContext);
		return (
			<button type="button" onClick={() => onValueChange?.(value)}>
				{children}
			</button>
		);
	};

	return {
		Select,
		SelectTrigger,
		SelectValue,
		SelectContent,
		SelectItem,
	};
});

describe("ProjectsPage", () => {
	beforeAll(() => {
		if (!HTMLElement.prototype.scrollIntoView) {
			HTMLElement.prototype.scrollIntoView = () => {};
		}
		if (!Element.prototype.hasPointerCapture) {
			Element.prototype.hasPointerCapture = () => false;
		}
		if (!Element.prototype.setPointerCapture) {
			Element.prototype.setPointerCapture = () => {};
		}
		if (!Element.prototype.releasePointerCapture) {
			Element.prototype.releasePointerCapture = () => {};
		}
	});

	beforeEach(() => {
		jest.clearAllMocks();
		localStorage.clear();
		global.fetch = jest.fn().mockResolvedValue({ ok: false });
	});

	it("renders seeded projects when localStorage is empty", async () => {
		render(<ProjectsPage />);

		expect(screen.getByText("PROJECTS")).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText("Capstone Collaboration")).toBeInTheDocument();
			expect(screen.getByText("Finalize project scope")).toBeInTheDocument();
		});
	});

	it("loads projects from localStorage and lets a user join", async () => {
		const user = userEvent.setup();

		const storedProjects = [
			{
				id: "project-local-1",
				name: "Solo Project",
				description: "Only one member before joining",
				ownerId: "owner-1",
				members: [
					{
						id: "owner-1",
						name: "Owner User",
						handle: "owner@example.com",
						role: "owner",
					},
				],
				tasks: [],
				createdAt: new Date().toISOString(),
			},
		];

		localStorage.setItem("scholarsPlot.projects", JSON.stringify(storedProjects));

		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				id: "member-42",
				email: "member42@example.com",
				name: "Member 42",
				image: null,
			}),
		});

		render(<ProjectsPage />);

		await waitFor(() => {
			expect(screen.getByText("Solo Project")).toBeInTheDocument();
			expect(screen.getByText("1 member")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: /join project/i }));

		await waitFor(() => {
			expect(screen.getByText("2 members")).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /project settings/i }),
			).toBeInTheDocument();
		});
	});

	it("lets a signed-in user create a project and manage tasks as owner", async () => {
		const user = userEvent.setup();

		localStorage.setItem("scholarsPlot.projects", JSON.stringify([]));

		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				id: "owner-99",
				email: "owner99@example.com",
				name: "Owner 99",
				image: null,
			}),
		});

		render(<ProjectsPage />);

		await waitFor(() => {
			expect(
				screen.getByText("Create or select a project to view tasks."),
			).toBeInTheDocument();
		});

		await user.click(screen.getByText("New Project"));

		await user.type(screen.getByPlaceholderText("Project name"), "My Owner Project");
		await user.type(
			screen.getByPlaceholderText("Optional description"),
			"Owner-managed workflow project",
		);
		await user.click(screen.getByRole("button", { name: /^Create$/i }));

		await waitFor(() => {
			expect(screen.getByText("My Owner Project")).toBeInTheDocument();
			expect(screen.getByText("OWNER")).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /new task/i }),
			).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: /new task/i }));
		await user.type(
			screen.getByPlaceholderText("e.g. Finalize onboarding docs"),
			"Owner Task 1",
		);
		await user.click(screen.getByRole("button", { name: /create task/i }));

		await waitFor(() => {
			expect(screen.getByText("Owner Task 1")).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: /join project/i })).not.toBeInTheDocument();
		});
	});
});
