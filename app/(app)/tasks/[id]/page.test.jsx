import { render, screen } from "@testing-library/react";
import TaskDetailPage from "./page";
import { mockTasks } from "@/lib/mock-data";

jest.mock("../../../components/tasks/task-delete-button", () => ({
  TaskDeleteButton: () => <button data-testid="mock-delete">Delete</button>,
}));

describe("TaskDetailPage", () => {
  // Grab the first task from your actual mock file to use for the test
  const existingTask = mockTasks[0];
  const params = { id: existingTask.id };

  it("renders the specific task details from the mock library", () => {
    render(<TaskDetailPage params={params} />);

    // Take one of the task's title
    expect(screen.getByText(existingTask.title)).toBeInTheDocument();

    // Check for description if it exists in that specific mock task
    if (existingTask.description) {
      expect(screen.getByText(existingTask.description)).toBeInTheDocument();
    }
  });

  it("shows the not found state for a random ID", () => {
    // This ID definitely won't be in your lib
    render(<TaskDetailPage params={{ id: "ilovepohonsawitsomuch" }} />);

    expect(screen.getByText(/Task not found/i)).toBeInTheDocument();
  });
});
