"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sampleCurve, curvePath, normalizePhase } = require("../docs/javascripts/math-playground.js");

test("all presets yield finite, bounded, closed curves at every slider phase", function () {
  for (const [a, b] of [[2, 3], [3, 4], [5, 6]]) {
    for (let phase = 0; phase <= 360; phase += 5) {
      const points = sampleCurve(a, b, phase);
      assert.equal(points.length, 241);
      for (const [x, y] of points) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y));
        assert.ok(x >= 64 - 1e-10 && x <= 296 + 1e-10);
        assert.ok(y >= 23 - 1e-10 && y <= 149 + 1e-10);
      }
      assert.ok(Math.abs(points[0][0] - points.at(-1)[0]) < 1e-10);
      assert.ok(Math.abs(points[0][1] - points.at(-1)[1]) < 1e-10);
    }
  }
});

test("phase is periodic; the controls and equations agree at t = 0", function () {
  for (const [a, b] of [[2, 3], [3, 4], [5, 6]]) {
    assert.deepEqual(sampleCurve(a, b, 45), sampleCurve(a, b, 405));
    assert.deepEqual(sampleCurve(a, b, -90), sampleCurve(a, b, 270));
    assert.deepEqual(sampleCurve(a, b, 0), sampleCurve(a, b, 360));
    assert.deepEqual(sampleCurve(a, b, 90)[0], [296, 86]);
  }
  assert.equal(normalizePhase(-10), 350);
  assert.equal(normalizePhase(721), 1);
});

test("path data uses only finite SVG move and line coordinates", function () {
  const data = curvePath(5, 6, 137);
  assert.match(data, /^M\d+\.\d{2},\d+\.\d{2}( L\d+\.\d{2},\d+\.\d{2}){240}$/);
});

test("invalid or unbounded curve input is rejected", function () {
  for (const args of [[0, 3, 45], [2, 99, 45], [2.5, 3, 45], [2, 3, Infinity], [2, 3, NaN], [2, 3, 45, 0], [2, 3, 45, 10000]]) {
    assert.throws(function () { sampleCurve(...args); }, RangeError);
  }
});

test("the static no-JavaScript SVG is the actual default 2:3, 45-degree curve", function () {
  const markdown = fs.readFileSync(path.join(__dirname, "../docs/index.md"), "utf8");
  const trace = markdown.match(/<path data-hm-trace[^>]* d="([^"]+)"/);
  const highlight = markdown.match(/<path data-hm-highlight[^>]* d="([^"]+)"/);
  assert.ok(trace && highlight);
  assert.equal(trace[1], curvePath(2, 3, 45, 180));
  assert.equal(highlight[1], trace[1]);
  assert.match(markdown, /data-hm-math-controls hidden/);
  assert.match(markdown, /type="range" min="0" max="360" value="45" step="1"/);
});
