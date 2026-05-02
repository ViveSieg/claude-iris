/* Shared ASCII banner for the claude-iris CLI and npm postinstall.
   Tri-stop gradient (coral → amber → teal) to match the brand palette;
   no-color/non-TTY fallback degrades gracefully so this never garbles
   piped output or CI logs.
*/
"use strict";

const path = require("path");

let VERSION = "";
try {
  VERSION = require(path.resolve(__dirname, "..", "package.json")).version || "";
} catch (_) {}

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const CORAL = "\x1b[38;2;204;120;92m";
const TEAL = "\x1b[38;2;93;184;166m";

const ART = String.raw`
 ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗    ██╗██████╗ ██╗███████╗
██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝    ██║██╔══██╗██║██╔════╝
██║     ██║     ███████║██║   ██║██║  ██║█████╗█████╗██║██████╔╝██║███████╗
██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝╚════╝██║██╔══██╗██║╚════██║
╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗    ██║██║  ██║██║███████║
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚═╝╚═╝  ╚═╝╚═╝╚══════╝
`;

function gradientLine(text, t) {
  const stops = [
    [204, 120, 92],  // coral  #cc785c
    [232, 165, 90],  // amber  #e8a55a
    [93, 184, 166],  // teal   #5db8a6
  ];
  const seg = t < 0.5 ? 0 : 1;
  const k = seg === 0 ? t * 2 : (t - 0.5) * 2;
  const a = stops[seg];
  const b = stops[seg + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * k);
  const g = Math.round(a[1] + (b[1] - a[1]) * k);
  const bb = Math.round(a[2] + (b[2] - a[2]) * k);
  return `\x1b[38;2;${r};${g};${bb}m${text}${RESET}`;
}

function print() {
  const v = VERSION ? " v" + VERSION : "";
  if (process.env.NO_COLOR || !process.stdout.isTTY) {
    console.log("\n  claude-iris" + v + "\n");
    return;
  }
  const lines = ART.split("\n").filter((l) => l.trim().length > 0);
  console.log("");
  lines.forEach((line, i) => {
    const t = lines.length > 1 ? i / (lines.length - 1) : 0;
    console.log(gradientLine(line, t));
  });
  console.log("  " + CORAL + "─".repeat(72) + RESET);
  console.log(
    "  " + DIM + "see Claude clearly · 让 Claude 看得清楚" + RESET +
    (VERSION ? "    " + TEAL + "v" + VERSION + RESET : "")
  );
  console.log("  " + DIM + "https://github.com/ViveSieg/claude-iris" + RESET);
  console.log("");
}

module.exports = { print, VERSION, RESET, DIM, CORAL, TEAL };
