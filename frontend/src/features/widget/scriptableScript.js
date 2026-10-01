// Source for a Scriptable (iOS) home-screen widget that shows today's
// mutabaah score from the read-only widget URL. Users paste this into the
// Scriptable app; `dataUrl` and `appUrl` are baked in when it's generated.
export function buildScriptableScript({ dataUrl, appUrl }) {
  return `// Double 4 Flat — mutabaah score widget
// Paste into Scriptable, then add a Scriptable widget to your home screen
// and choose this script. Keep this link private.
const DATA_URL = ${JSON.stringify(dataUrl)};
const APP_URL = ${JSON.stringify(appUrl)};

const GREEN = new Color("#1f5d50");
const GOLD = new Color("#c98a3b");
const INK = Color.dynamic(new Color("#16302b"), new Color("#e4eeea"));
const SOFT = Color.dynamic(new Color("#55706b"), new Color("#94aba5"));
const BG = Color.dynamic(new Color("#ffffff"), new Color("#172221"));

async function load() {
  try {
    const req = new Request(DATA_URL);
    req.timeoutInterval = 60; // free-tier server may need to wake up
    return await req.loadJSON();
  } catch (e) {
    return null;
  }
}

function bar(done, total, width) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, 8);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const track = new Path();
  track.addRoundedRect(new Rect(0, 0, width, 8), 4, 4);
  ctx.addPath(track);
  ctx.setFillColor(new Color("#888888", 0.25));
  ctx.fillPath();
  if (done > 0) {
    const fill = new Path();
    fill.addRoundedRect(new Rect(0, 0, Math.max(8, (width * done) / total), 8), 4, 4);
    ctx.addPath(fill);
    ctx.setFillColor(GREEN);
    ctx.fillPath();
  }
  return ctx.getImage();
}

const data = await load();
const w = new ListWidget();
w.backgroundColor = BG;
w.url = APP_URL;
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
const family = config.widgetFamily || "small";

if (!data || data.error) {
  const t = w.addText(data && data.error ? data.error : "Couldn't load your mutabaah. Will retry soon.");
  t.font = Font.mediumSystemFont(12);
  t.textColor = SOFT;
} else {
  const title = w.addText("Mutabaah");
  title.font = Font.semiboldSystemFont(12);
  title.textColor = SOFT;
  w.addSpacer(4);

  const pct = w.addText(data.percent + "%");
  pct.font = Font.boldSystemFont(family === "small" ? 34 : 30);
  pct.textColor = INK;

  const sub = w.addText(data.done + "/" + data.total + " today" + (data.streak > 0 ? "  🔥 " + data.streak : ""));
  sub.font = Font.mediumSystemFont(12);
  sub.textColor = data.streak > 0 ? GOLD : SOFT;
  w.addSpacer(8);
  w.addImage(bar(data.done, data.total, family === "small" ? 120 : 280));

  if (family !== "small") {
    w.addSpacer(8);
    const left = data.items.filter((i) => !i.done).map((i) => i.label);
    const line = w.addText(left.length ? "Left: " + left.join(", ") : "All done today, alhamdulillah 🌙");
    line.font = Font.systemFont(11);
    line.textColor = SOFT;
    line.lineLimit = 2;
  }
  if (data.tilawahPages > 0 && family !== "small") {
    const tp = w.addText("Tilawah: " + data.tilawahPages + " pages");
    tp.font = Font.systemFont(11);
    tp.textColor = SOFT;
  }
}

if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  await w.presentMedium();
}
Script.complete();
`;
}
