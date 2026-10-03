#!/usr/bin/env node
/**
 * NEVER ENDING A&R — weekly stats refresh
 *
 * Reads the Stats tab of the Google Sheet (via the Apps Script doGet in
 * Code.gs), then:
 *   1. writes data/stats.json  — the chart's history lives here
 *   2. patches the numbers in index.html in place, anchored on data-stat
 *      attributes, so the page stays correct for crawlers and for anyone
 *      with JS off. Nothing is rendered client-side except the chart.
 *
 * Run by .github/workflows/stats.yml every Monday. Also runnable by hand:
 *   STATS_ENDPOINT="https://script.google.com/.../exec" node scripts/update-stats.js
 *   node scripts/update-stats.js --dry-run     (prints the diff, writes nothing)
 *
 * It is deliberately hard to make this publish a wrong number: a fetch
 * failure, a malformed payload, a shrinking history or a lifetime total
 * that moves more than SANITY_MAX all abort with a non-zero exit and
 * leave the committed files untouched. A stale number beats a false one.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STATS_JSON = path.join(ROOT, "data", "stats.json");
const INDEX_HTML = path.join(ROOT, "index.html");

const DRY = process.argv.includes("--dry-run");
const ENDPOINT = process.env.STATS_ENDPOINT || "";

/* A single week should never swing the lifetime total by more than this.
   Guards against a mistyped cell (an extra digit) reaching the live site. */
const SANITY_MAX = 2_000_000;

function die(msg) {
  console.error("ABORT: " + msg);
  console.error("Committed files were left unchanged.");
  process.exit(1);
}

const fmt = (n) => Number(n).toLocaleString("en-US");

/* ---------- fetch ---------- */

async function fetchStats() {
  if (!ENDPOINT) die("STATS_ENDPOINT is not set.");
  const url = ENDPOINT + (ENDPOINT.includes("?") ? "&" : "?") + "stats=1";

  let res;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch (err) {
    die("could not reach the Apps Script endpoint: " + err.message);
  }
  if (!res.ok) die(`endpoint returned HTTP ${res.status}`);

  const text = await res.text();

  /* Two shapes are accepted, so the endpoint can be either the Apps Script
     doGet (JSON) or the Stats tab published straight to the web (CSV).
     Publishing needs no deployment and cannot silently serve stale code,
     which is why it is the recommended option. */
  const trimmed = text.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let body;
    try {
      body = JSON.parse(trimmed);
    } catch {
      die("endpoint returned something that starts like JSON but will not parse:\n" + trimmed.slice(0, 200));
    }
    if (body.ok === false) die("endpoint reported: " + (body.error || "unknown error"));
    /* The old doGet answers every request with a health message. Treat that
       as "the new code is not deployed" rather than as data. */
    if (!body.current && body.msg) {
      die(
        "the endpoint answered with its health message, not stats:\n  " + body.msg +
        "\nThat means the Apps Script deployment is still serving the OLD code " +
        "(Manage deployments > edit > Version must be set to 'New version'), " +
        "or this URL belongs to a different deployment.\n" +
        "Simpler fix: publish the Stats tab via File > Share > Publish to web > CSV " +
        "and use that URL instead - this script reads CSV too."
      );
    }
    if (!body.current) die("endpoint returned JSON with no 'current' block");
    return body;
  }

  if (trimmed.toLowerCase().includes("<html") || trimmed.toLowerCase().startsWith("<!doctype")) {
    die(
      "endpoint returned an HTML page, not data. For Apps Script that means the " +
      "deployment is not set to 'Who has access: Anyone'; for a published CSV it " +
      "means the sheet is not actually published. First 200 chars:\n" + trimmed.slice(0, 200)
    );
  }

  return fromCsv(trimmed);
}

/* ---------- CSV ----------
   Minimal RFC-4180 reader: handles quoted fields, embedded commas and
   doubled quotes. The Stats tab has none of those today, but a pasted
   value easily introduces one. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

/* Column order on the site. Mirrors TRACK_COLS in Code.gs. */
const TRACK_COLS = [
  { key: "s80",          name: "s80",                    tag: "1M plaque" },
  { key: "henny",        name: "Henny",                  tag: "w/ DG" },
  { key: "bigsteppin",   name: "BigSteppin",             tag: "" },
  { key: "runforyolife", name: "Run For Yo Life Remixx", tag: "" },
];

const toNum = (v) => {
  if (v == null || String(v).trim() === "") return 0;
  return Math.round(parseFloat(String(v).replace(/[^0-9.\-]/g, "")) || 0);
};

/* Accepts 2026-10-03, 10/3/2026 and 3-Oct-2026; returns YYYY-MM-DD. */
function toYmd(v) {
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (isNaN(d)) die(`could not read "${s}" in the date column as a date`);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) die("the CSV has no data rows - add a row under the headers in the Stats tab");

  const head = {};
  rows[0].forEach((h, i) => { head[String(h).toLowerCase().replace(/[^a-z0-9_]/g, "")] = i; });
  for (const need of ["date", "lifetime"]) {
    if (head[need] === undefined)
      die(`the CSV has no '${need}' column. Headers found: ${rows[0].join(", ")}`);
  }

  const data = rows.slice(1)
    .filter((r) => String(r[head.date] || "").trim() !== "")
    .sort((a, b) => new Date(a[head.date]) - new Date(b[head.date]));
  if (!data.length) die("the CSV has headers but no dated rows");

  const last = data[data.length - 1];
  const pick = (r, k) => (head[k] === undefined ? null : toNum(r[head[k]]));

  return {
    ok: true,
    updated: toYmd(last[head.date]),
    current: {
      lifetime: toNum(last[head.lifetime]),
      releases: pick(last, "releases") ?? 0,
      spotifyFollowers: pick(last, "spotify_followers"),
      youtubeSubs: pick(last, "youtube_subs"),
      tracks: TRACK_COLS
        .filter((t) => head[t.key] !== undefined)
        .map((t) => ({ name: t.name, tag: t.tag, value: toNum(last[head[t.key]]) }))
        .sort((a, b) => b.value - a.value),
    },
    history: data.map((r) => ({ date: toYmd(r[head.date]), lifetime: toNum(r[head.lifetime]) })),
  };
}

/* ---------- validate ---------- */

function validate(incoming, previous) {
  const c = incoming.current;
  if (!c) die("payload has no 'current' block");
  if (!Number.isFinite(c.lifetime) || c.lifetime <= 0)
    die("lifetime is not a positive number: " + c.lifetime);
  if (!Array.isArray(incoming.history) || !incoming.history.length)
    die("payload has no history rows");
  if (!Array.isArray(c.tracks) || !c.tracks.length)
    die("payload has no tracks");

  const prev = previous && previous.current ? previous.current.lifetime : 0;
  const prevLen = previous && previous.history ? previous.history.length : 0;

  /* The sheet is append-only by instruction; a shorter history means rows
     were deleted, which would silently truncate the chart. */
  if (incoming.history.length < prevLen)
    die(
      `history shrank (${prevLen} rows -> ${incoming.history.length}). ` +
        "Rows were deleted from the Stats tab; refusing to truncate the chart."
    );

  if (prev && c.lifetime < prev)
    die(`lifetime went backwards (${fmt(prev)} -> ${fmt(c.lifetime)}). Check the sheet for a typo.`);

  if (prev && c.lifetime - prev > SANITY_MAX)
    die(
      `lifetime jumped ${fmt(c.lifetime - prev)} in one week ` +
        `(${fmt(prev)} -> ${fmt(c.lifetime)}), over the ${fmt(SANITY_MAX)} sanity limit. ` +
        "If that is real, raise SANITY_MAX in this script."
    );

  const sum = c.tracks.reduce((a, t) => a + (t.value || 0), 0);
  if (sum > c.lifetime)
    console.warn(
      `  warn: tracked songs sum to ${fmt(sum)}, above the ${fmt(c.lifetime)} lifetime total.`
    );
}

/* ---------- html patching ----------
   Every number in index.html carries data-stat="<key>". We rewrite only
   the data-count attribute and, where the element shows a real figure
   rather than a count-up placeholder, its text. Anything without an
   anchor is left alone. */

function patchHtml(html, stats) {
  const c = stats.current;
  const edits = [];

  const values = {
    lifetime: c.lifetime,
    releases: c.releases,
  };
  c.tracks.forEach((t, i) => {
    values["track" + i] = t.value;
  });

  /* 1. data-count attributes (the value the count-up animation reads) */
  for (const [key, val] of Object.entries(values)) {
    if (!Number.isFinite(val)) continue;
    const re = new RegExp(
      `(data-stat="${key}"[^>]*?data-count=")(\\d+)(")`,
      "g"
    );
    html = html.replace(re, (m, a, old, b) => {
      if (old !== String(val)) edits.push(`  ${key}: data-count ${fmt(old)} -> ${fmt(val)}`);
      return a + val + b;
    });
    /* attribute order may be reversed */
    const re2 = new RegExp(
      `(data-count=")(\\d+)("[^>]*?data-stat="${key}")`,
      "g"
    );
    html = html.replace(re2, (m, a, old, b) => {
      if (old !== String(val)) edits.push(`  ${key}: data-count ${fmt(old)} -> ${fmt(val)}`);
      return a + val + b;
    });
  }

  /* 2. elements that print a formatted figure as their text */
  for (const [key, val] of Object.entries(values)) {
    if (!Number.isFinite(val)) continue;
    const re = new RegExp(
      `(<[^>]*data-stat-text="${key}"[^>]*>)([^<]*)(</)`,
      "g"
    );
    html = html.replace(re, (m, open, old, close) => {
      const next = fmt(val);
      if (old.trim() !== next) edits.push(`  ${key}: text "${old.trim()}" -> "${next}"`);
      return open + next + close;
    });
  }

  /* 3. track-list bar scaling: every row is scaled against the top track */
  const top = Math.max(...c.tracks.map((t) => t.value || 0));
  c.tracks.forEach((t, i) => {
    const re = new RegExp(`(data-stat="track${i}"[^>]*?--max:)(\\d+)`, "g");
    html = html.replace(re, (m, a) => a + top);
    const re2 = new RegExp(`(data-stat="track${i}"[^>]*?data-val=")(\\d+)(")`, "g");
    html = html.replace(re2, (m, a, old, b) => a + t.value + b);
  });

  /* 4. meta descriptions. Crawlers never run JS, so the link-preview
        numbers have to be correct in the source. Only the digits inside
        the known phrasings are touched. */
  const metaBefore = html;
  html = html.replace(/([\d,]{5,})(\s+streams, zero label)/g, (m, _n, tail) => fmt(c.lifetime) + tail);
  html = html.replace(/(—\s*)[\d.]+M\+(\s+streams, zero label)/g, (m, a, b) => a + mShort(c.lifetime) + b);
  if (html !== metaBefore) edits.push(`  meta: descriptions set to ${fmt(c.lifetime)}`);

  return { html, edits };
}

/* 4,969,144 -> "4.9M+" for the short meta phrasing */
function mShort(n) {
  return (Math.floor(n / 100000) / 10).toFixed(1).replace(/\.0$/, "") + "M+";
}

/* ---------- main ---------- */

(async function main() {
  const previous = fs.existsSync(STATS_JSON)
    ? JSON.parse(fs.readFileSync(STATS_JSON, "utf8"))
    : null;

  const incoming = await fetchStats();
  validate(incoming, previous);

  const out = {
    updated: incoming.updated,
    note: "Written by scripts/update-stats.js from the Stats tab of the Google Sheet. Do not hand-edit; edit the sheet.",
    current: incoming.current,
    history: incoming.history,
  };

  const nextJson = JSON.stringify(out, null, 2) + "\n";
  const jsonChanged = !previous || nextJson !== fs.readFileSync(STATS_JSON, "utf8");

  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const { html: nextHtml, edits } = patchHtml(html, out);
  const htmlChanged = nextHtml !== html;

  console.log(`updated:  ${out.updated}`);
  console.log(`lifetime: ${fmt(out.current.lifetime)}`);
  console.log(`history:  ${out.history.length} week(s) logged`);
  console.log(`tracks:   ${out.current.tracks.map((t) => `${t.name} ${fmt(t.value)}`).join(", ")}`);

  if (edits.length) {
    console.log("\nhtml edits:");
    edits.forEach((e) => console.log(e));
  } else {
    console.log("\nhtml: already current");
  }

  if (DRY) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  if (jsonChanged) fs.writeFileSync(STATS_JSON, nextJson);
  if (htmlChanged) fs.writeFileSync(INDEX_HTML, nextHtml);

  if (!jsonChanged && !htmlChanged) {
    console.log("\nno changes.");
  } else {
    console.log(
      `\nwrote: ${[jsonChanged && "data/stats.json", htmlChanged && "index.html"].filter(Boolean).join(", ")}`
    );
  }
})();
