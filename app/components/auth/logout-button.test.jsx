import { render, screen } from "@testing-library/react";
import LogoutButton from "./logout-button";

// We need to use jest mock because our component uses next JS hooks: useRouter
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

describe("Logout Button component", () => {
  test("renders button with correct label", () => {
    render(<LogoutButton label="Logout" />);
    const button = screen.getByText("Logout");
    expect(button).toBeInTheDocument();
  });
});
