import type { StudySession } from "@/types";

const STUDY_SESSION_CACHE_KEY = "scholarsPlot.studySessions";
const STUDY_SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

type StudySessionCachePayload = {
	savedAt: number;
	sessions: StudySession[];
};

const canUseStorage = () => typeof window !== "undefined";

export function getCachedStudySessions(): StudySession[] | null {
	if (!canUseStorage()) return null;

	const rawValue = window.localStorage.getItem(STUDY_SESSION_CACHE_KEY);
	if (!rawValue) return null;

	try {
		const parsed = JSON.parse(rawValue) as Partial<StudySessionCachePayload>;

		if (!Array.isArray(parsed.sessions) || typeof parsed.savedAt !== "number") {
			clearCachedStudySessions();
			return null;
		}

		const isExpired = Date.now() - parsed.savedAt > STUDY_SESSION_CACHE_TTL_MS;
		if (isExpired) {
			clearCachedStudySessions();
			return null;
		}

		return parsed.sessions;
	} catch {
		clearCachedStudySessions();
		return null;
	}
}

export function setCachedStudySessions(sessions: StudySession[]) {
	if (!canUseStorage()) return;

	const payload: StudySessionCachePayload = {
		savedAt: Date.now(),
		sessions,
	};

	window.localStorage.setItem(
		STUDY_SESSION_CACHE_KEY,
		JSON.stringify(payload),
	);
}

export function clearCachedStudySessions() {
	if (!canUseStorage()) return;

	window.localStorage.removeItem(STUDY_SESSION_CACHE_KEY);
}
