jest.mock("next/server", () => ({
    NextResponse: {
        json: (body) => {
            let setCookie = null;

            return {
                json: async () => body,
                headers: {
                    get: (name) =>
                        name.toLowerCase() === "set-cookie" ? setCookie : null,
                },
                cookies: {
                    set: (name, value, options = {}) => {
                        const expires =
                            options.expires instanceof Date
                                ? `; Expires=${options.expires.toUTCString()}`
                                : "";
                        setCookie = `${name}=${value}; Path=${options.path || "/"}${expires}`;
                    },
                },
            };
        },
    },
}));

import { POST } from "./route";

test("returns correct response", async () => {
    const response = await POST();
    const data = await response.json();

    expect(data.message).toBe("Logged out");
    expect(response.headers.get("set-cookie")).toContain("session=");
});