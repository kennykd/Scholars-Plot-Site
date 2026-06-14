import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { SyntheticEvent } from "react";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Opens a native date/time input's picker on interaction. Browsers only open
 * the picker when the small calendar/clock glyph is clicked; calling
 * `showPicker()` on click/focus makes the whole field open it. Guarded because
 * `showPicker()` throws if not triggered by a user gesture or when unsupported.
 */
export function openNativePicker(event: SyntheticEvent<HTMLInputElement>) {
	try {
		event.currentTarget.showPicker?.();
	} catch {
		// no-op: unsupported browser or non-user-activated call
	}
}
