/* MH Movies Floating Iframe Detector */
(() => {
  const ball = document.createElement("div");
  ball.id = "mhExtractorBall";
  ball.textContent = "🔎";

  Object.assign(ball.style, {
    position: "fixed",
    right: "18px",
    bottom: "100px",
    width: "54px",
    height: "54px",
    borderRadius: "50%",
    background: "#111",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "25px",
    zIndex: "2147483647",
    boxShadow: "0 4px 15px rgba(0,0,0,.45)",
    cursor: "pointer",
    userSelect: "none"
  });

  document.body.appendChild(ball);

  ball.addEventListener("click", () => {
    const iframes = [...document.querySelectorAll("iframe")];

    if (!iframes.length) {
      alert("No iframe detected on this page.");
      return;
    }

    const urls = iframes
      .map(frame => frame.getAttribute("src"))
      .filter(Boolean)
      .map(src => new URL(src, location.href).href);

    alert(
      `Found ${urls.length} iframe(s):\n\n` +
      urls.join("\n\n")
    );
  });
})();
