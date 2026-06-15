import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { CalendarView } from "@/app/(app)/calendar/calendar-view";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@fullcalendar/react", () => ({
  __esModule: true,
  default: ({ events, eventClick }) => (
    <div>
      {events.map((event) => (
        <button
          key={event.id}
          type="button"
          onClick={() =>
            eventClick({
              event: { extendedProps: event.extendedProps },
            })
          }
        >
          {event.title}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@fullcalendar/daygrid", () => ({}));
jest.mock("@fullcalendar/timegrid", () => ({}));

describe("CalendarView study sessions", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useRouter.mockReturnValue({ push: mockPush });
  });

  it("renders study session events with a legend and opens the timer when clicked", () => {
    render(
      <CalendarView
        tasks={[]}
        sessions={[
          {
            id: 11,
            title: "Mechanical Physics",
            scheduledAt: "2099-03-23T15:00:00.000Z",
            focusMinutes: 25,
          },
        ]}
      />,
    );

    expect(screen.getByText(/Task deadlines/i)).toBeInTheDocument();
    expect(screen.getByText(/Study sessions/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Study: Mechanical Physics/i }));

    expect(mockPush).toHaveBeenCalledWith("/study/11");
  });
});
