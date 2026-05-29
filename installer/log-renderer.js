const logEl = document.getElementById("log");
const clearBtn = document.getElementById("clear");

if (window.logView) {
    window.logView.onAppend(text => {
        logEl.textContent += text;
        logEl.scrollTop = logEl.scrollHeight;
    });
    window.logView.onClear(() => {
        logEl.textContent = "";
    });
    clearBtn.addEventListener("click", () => window.logView.clear());
} else {
    logEl.textContent = "Log preload failed to load.\n";
}
