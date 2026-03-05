import { render, screen, fireEvent } from "@testing-library/react";
import StudyPage from "./page";
import { useRouter } from "next/navigation";

// Mock the NextJS router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock LocalStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("StudyPage Client Component", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useRouter.mockReturnValue({ push: mockPush });
    localStorage.clear();
  });

  it("renders the study sessions header", () => {
    render(<StudyPage />);
    expect(screen.getByText(/STUDY SESSIONS/i)).toBeInTheDocument();
    expect(screen.getByText(/UPCOMING STUDY PLAN/i)).toBeInTheDocument();
  });

  it("allows a user to input a quick timer and add it to the list", async () => {
    render(<StudyPage />);

    const titleInput = screen.getByPlaceholderText(/Timer only/i);
    const addButton = screen.getByText(/Add Timer/i);

    // Simulate user typing
    fireEvent.change(titleInput, {
      target: { value: "Website Application Design" },
    });
    fireEvent.click(addButton);

    // Check if the new session appears in the list, uses await since the component may not appear instantly
    expect(
      await screen.findByText("Website Application Design"),
    ).toBeInTheDocument();

    // Check if it was saved to localStorage
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it("navigates to the session detail page when 'Start' is clicked", () => {
    render(<StudyPage />);

    // We need to find a 'Start' button. Since mock data is seeded
    // in the component's useEffect, we'll wait for it to render.
    const startButtons = screen.getAllByText(/Start/i);
    fireEvent.click(startButtons[0]);

    // Verify it calls router.push with the expected path format
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/\/study\/.+/));
  });

  it("displays the empty state message when no sessions exist", () => {
    // Force sessions to be empty by mocking an empty array in localStorage
    localStorage.getItem.mockReturnValue(JSON.stringify([]));

    render(<StudyPage />);

    expect(screen.getByText(/No upcoming sessions/i)).toBeInTheDocument();
  });
});
