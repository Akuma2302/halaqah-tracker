// Source for a Scriptable (iOS) home-screen widget that shows what's next in
// the Timetable, in the manner of a calendar app's widget: small (the date
// and the next thing), medium (today and tomorrow) and large (the month with
// what's coming). Users paste this into the Scriptable app; `dataUrl` and
// `appUrl` are baked in when it's generated.
export function buildAgendaScript({ dataUrl, appUrl }) {
  return `// Double 4 Flat — timetable widget ("What's next")
// Paste into Scriptable, then add a Scriptable widget to your home screen
// (small, medium or large) and choose this script. Keep this link private.
const DATA_URL = ${JSON.stringify(dataUrl)};
const APP_URL = ${JSON.stringify(appUrl)};

const INK = Color.dynamic(new Color("#16302b"), new Color("#f2f6f4"));
const SOFT = Color.dynamic(new Color("#55706b"), new Color("#9fb3ae"));
const BG = Color.dynamic(new Color("#ffffff"), new Color("#1c1f22"));
const TODAY = new Color("#2f8f78");
const TONES = {
  class: new Color("#2f8f78"),
  task: new Color("#3d8fd1"),
  due: new Color("#3d8fd1"),
  exam: new Color("#c98a3b")
};
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const LONG_DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

async function load() {
  try {
    const req = new Request(DATA_URL);
    req.timeoutInterval = 60; // free-tier server may need to wake up
    return await req.loadJSON();
  } catch (e) {
    return null;
  }
}

function clock(t) {
  const p = t.split(":");
  const h = Number(p[0]);
  return (h % 12 || 12) + ":" + p[1] + (h < 12 ? " AM" : " PM");
}
function parse(key) {
  const p = key.split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
function addDays(key, n) {
  const d = parse(key);
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function whenText(e) {
  if (e.allDay) return "All day";
  return clock(e.time) + (e.end ? "–" + clock(e.end) : "");
}

// A coloured block for one event: one line (time then title) or two.
function block(parent, e, twoLines) {
  const s = parent.addStack();
  s.layoutVertically();
  s.backgroundColor = TONES[e.kind] || TONES.class;
  s.cornerRadius = 9;
  s.setPadding(twoLines ? 6 : 4, 9, twoLines ? 6 : 4, 9);
  if (twoLines) {
    const t = s.addText(e.title);
    t.font = Font.semiboldSystemFont(13);
    t.textColor = Color.white();
    t.lineLimit = 1;
    const w = s.addText(whenText(e));
    w.font = Font.systemFont(12);
    w.textColor = new Color("#ffffff", 0.92);
    w.lineLimit = 1;
  } else {
    const row = s.addStack();
    const w = row.addText(e.allDay ? "All day " : clock(e.time) + " ");
    w.font = Font.systemFont(12);
    w.textColor = new Color("#ffffff", 0.92);
    const t = row.addText(e.title);
    t.font = Font.semiboldSystemFont(12);
    t.textColor = Color.white();
    t.lineLimit = 1;
    row.addSpacer();
  }
  return s;
}

function label(parent, text) {
  const t = parent.addText(text);
  t.font = Font.semiboldSystemFont(11);
  t.textColor = SOFT;
  return t;
}

// The month as a picture: weekday letters, the dates, today circled, and a
// dot under days that have something on.
function monthImage(todayKey, busy, width, height) {
  const today = parse(todayKey);
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // weeks start on Monday
  const count = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const rows = Math.ceil((lead + count) / 7);
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const cw = width / 7;
  const head = 16;
  const ch = (height - head) / rows;
  ctx.setTextAlignedCenter();
  ctx.setFont(Font.semiboldSystemFont(9));
  ctx.setTextColor(SOFT);
  ["M", "T", "W", "T", "F", "S", "S"].forEach((d, i) => ctx.drawTextInRect(d, new Rect(i * cw, 0, cw, head)));
  for (let day = 1; day <= count; day++) {
    const cell = lead + day - 1;
    const x = (cell % 7) * cw;
    const y = head + Math.floor(cell / 7) * ch;
    const isToday = day === today.getDate();
    if (isToday) {
      const r = Math.min(cw, ch) - 4;
      ctx.setFillColor(TODAY);
      ctx.fillEllipse(new Rect(x + (cw - r) / 2, y + (ch - r) / 2, r, r));
    }
    ctx.setFont(isToday ? Font.boldSystemFont(11) : Font.systemFont(11));
    ctx.setTextColor(isToday ? Color.white() : INK);
    ctx.drawTextInRect(String(day), new Rect(x, y + (ch - 14) / 2, cw, 14));
    const key = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    if (busy[key] && !isToday) {
      ctx.setFillColor(TODAY);
      ctx.fillEllipse(new Rect(x + cw / 2 - 1.5, y + ch - 5, 3, 3));
    }
  }
  return ctx.getImage();
}

const data = await load();
const w = new ListWidget();
w.backgroundColor = BG;
w.url = APP_URL + "/timetable";
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
const family = config.widgetFamily || "medium";

if (!data || data.error || !data.events) {
  const t = w.addText(data && data.error ? data.error : "Couldn't load your timetable. Will retry soon.");
  t.font = Font.mediumSystemFont(12);
  t.textColor = SOFT;
} else {
  const now = new Date();
  const nowTime = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  const todayKey = data.date;
  const tomorrowKey = addDays(todayKey, 1);
  // Today's finished events drop off; everything later stays.
  const upcoming = data.events.filter((e) => e.date > todayKey || e.allDay || (e.end || e.time) >= nowTime);
  const todays = upcoming.filter((e) => e.date === todayKey);
  const later = upcoming.filter((e) => e.date > todayKey);
  const d = parse(todayKey);
  const dayLabel = (key) => (key === tomorrowKey ? "TOMORROW" : DAYS[parse(key).getDay()] + " " + parse(key).getDate());

  // Up to "room" events as blocks, each new day introduced by its label.
  function list(parent, room, firstTwoLines) {
    let shown = 0;
    let lastDay = todayKey;
    if (!todays.length) {
      label(parent, "Nothing more today");
      parent.addSpacer(5);
    }
    upcoming.slice(0, room).forEach((e, i) => {
      if (e.date !== lastDay) {
        if (i > 0) parent.addSpacer(3);
        label(parent, dayLabel(e.date));
        parent.addSpacer(3);
        lastDay = e.date;
      }
      block(parent, e, firstTwoLines && i === 0 && e.date === todayKey);
      parent.addSpacer(4);
      shown++;
    });
    if (!shown) label(parent, "Nothing in the next two weeks");
  }

  if (family === "small") {
    label(w, LONG_DAYS[d.getDay()]);
    const num = w.addText(String(d.getDate()));
    num.font = Font.lightSystemFont(34);
    num.textColor = INK;
    w.addSpacer();
    const next = upcoming[0];
    if (next) {
      if (next.date !== todayKey) {
        label(w, dayLabel(next.date));
        w.addSpacer(3);
      }
      block(w, next, true);
    } else {
      label(w, "Nothing coming up");
    }
  } else if (family === "large") {
    const title = w.addText(MONTHS[d.getMonth()]);
    title.font = Font.semiboldSystemFont(12);
    title.textColor = SOFT;
    w.addSpacer(6);
    const busy = {};
    data.events.forEach((e) => (busy[e.date] = true));
    const img = w.addImage(monthImage(todayKey, busy, 310, 150));
    img.centerAlignImage();
    w.addSpacer(10);
    list(w, 4, true);
    w.addSpacer();
  } else {
    const row = w.addStack();
    row.layoutHorizontally();
    const left = row.addStack();
    left.layoutVertically();
    left.size = new Size(58, 0);
    label(left, DAYS[d.getDay()]);
    const num = left.addText(String(d.getDate()));
    num.font = Font.lightSystemFont(30);
    num.textColor = INK;
    left.addSpacer();
    row.addSpacer(8);
    const right = row.addStack();
    right.layoutVertically();
    list(right, 3, true);
    right.addSpacer();
  }
}

if (config.runsInWidget) {
  Script.setWidget(w);
} else if (family === "small") {
  await w.presentSmall();
} else if (family === "large") {
  await w.presentLarge();
} else {
  await w.presentMedium();
}
Script.complete();
`;
}
