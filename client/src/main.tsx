import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const CHUNK_RELOAD_KEY = "chunk-load-recovery";

const isChunkLoadError = (message: string) => {
	const text = String(message || "").toLowerCase();
	return (
		text.includes("failed to fetch dynamically imported module") ||
		text.includes("failed to load module script") ||
		text.includes("importing a module script failed")
	);
};

const tryChunkRecoveryReload = (reason: string) => {
	try {
		const hasReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
		if (hasReloaded) return;
		sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
		console.warn("🔁 Recovering from chunk load error:", reason);
		window.location.reload();
	} catch {
		window.location.reload();
	}
};

window.addEventListener("error", (event) => {
	const msg = event?.message || "";
	if (isChunkLoadError(msg)) {
		tryChunkRecoveryReload(msg);
	}
});

window.addEventListener("unhandledrejection", (event) => {
	const reason =
		typeof event?.reason === "string"
			? event.reason
			: event?.reason?.message || "";
	if (isChunkLoadError(reason)) {
		tryChunkRecoveryReload(reason);
	}
});

try {
	sessionStorage.removeItem(CHUNK_RELOAD_KEY);
} catch {}

createRoot(document.getElementById("root")!).render(<App />);
