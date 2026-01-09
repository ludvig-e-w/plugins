import ReactDOM from "react-dom";
import App from "./App";

// Use the older ReactDOM.render which is more compatible with Figma's iframe loading
function render() {
  const container = document.getElementById("root");
  if (container) {
    ReactDOM.render(<App />, container);
  }
}

// Try to render now, or wait for DOM
if (document.getElementById("root")) {
  render();
} else if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", render);
} else {
  // DOM is ready but root might not be - use mutation observer
  const observer = new MutationObserver((mutations, obs) => {
    if (document.getElementById("root")) {
      render();
      obs.disconnect();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  
  // Fallback timeout
  setTimeout(render, 100);
}
