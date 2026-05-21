#!/usr/bin/env node
/**
 * Bulk-expand lesson teachings via Claude API.
 *
 * Reads mobile/src/i18n/locales/lessons.<lang>.json, finds every lesson whose
 * teaching is still in the short (pre-expansion) form, calls Claude to rewrite
 * it in the 4-layer structure (scene → science → mechanism → practice) at
 * 180-220 words, beefs up the quiz explanations, and writes the updated file
 * back to disk.
 *
 * Idempotent — already-expanded lessons (detected by word count >= 150) are
 * skipped, so re-running the workflow only fills in the gaps.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *   node scripts/expand-lessons.mjs \
 *     --lessons mobile/src/i18n/locales/lessons.tr.json \
 *     --lang tr \
 *     [--paths dopamine-detox,silent-morning] \
 *     [--max 999]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";

const { values: args } = parseArgs({
  options: {
    lessons: { type: "string" },
    lang: { type: "string", default: "tr" },
    paths: { type: "string", default: "all" },
    max: { type: "string", default: "999" },
    model: { type: "string", default: "claude-sonnet-4-5" },
    "dry-run": { type: "boolean", default: false },
  },
});

if (!args.lessons) {
  console.error("Missing --lessons");
  process.exit(1);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Missing ANTHROPIC_API_KEY env var");
  process.exit(1);
}

const client = new Anthropic({ apiKey });

const lessonsPath = args.lessons;
const lang = args.lang;
const targetPaths =
  args.paths === "all" ? null : args.paths.split(",").map((s) => s.trim());
const maxLessons = parseInt(args.max, 10);
const dryRun = args["dry-run"];

const data = JSON.parse(readFileSync(lessonsPath, "utf8"));

const wordCount = (s) =>
  typeof s === "string" ? s.split(/\s+/).filter(Boolean).length : 0;

const PROMPT_TR = `Sen Ascend: Monk Mode disiplin uygulamasının içerik editörüsün. Türkçe içeriği genişlettiğin format aşağıdaki gibi olmalı.

GÖREV: Verilen lesson'un teaching ve quiz alanlarını 4 katmanlı yapıya genişlet. Mevcut "title", "action", "reflectionPrompt", "proTip" ALANLARINA DOKUNMA — onları aynen koru.

TEACHING GENİŞLETME KURALLARI:
- 180-220 kelime aralığında
- 4 katman, sırasıyla:
  1. SAHNE: Kullanıcının kendini içinde bulduğu somut bir gözlem (gece telefon, asansör, sıraya girme...). 1-2 paragraf.
  2. BİLİM: Gerçek bir araştırma/figür referansı (Huberman, Gloria Mark, Cal Newport, Anna Lembke, Skinner, Kahneman, Marcus Aurelius, Cal Newport, BJ Fogg, Lally, Duke, Stanford, Harvard, NYU, MIT, vs.). İsim ve yıl belirt.
  3. MEKANİZMA: NEDEN bu işliyor, beyin/davranış bilimi açıklaması.
  4. PRATİK: "Bugün ne yapacaksın" — somut.
- Mevcut teaching'in özüne sadık kal, sadece zenginleştir.
- Bold için **kelime** kullan (Markdown).
- Paragraflar arası \\n\\n.
- Türkçe akıcı, motive edici, doğrudan hitap ("sen" dili).

QUIZ EXPLAIN GENİŞLETME:
- Her quiz item'inin "explain" alanını 2-3 cümleye çıkar (önceki 1 cümle yetersizdi).
- Cevabın NEDEN doğru olduğunu açıkla + ilgili bilim referansı varsa kullan.
- Bold için **kelime** kullan.

ÇIKTI FORMATI:
SADECE JSON dön, başka hiçbir şey yazma. Şu yapıda:
{
  "teaching": "...genişletilmiş teaching...",
  "quiz": [
    { "q": "...aynen...", "options": [...aynen...], "correct": N, "explain": "...genişletilmiş..." },
    ...
  ]
}

q, options, correct değerlerini AYNEN koru. Sadece explain'leri güçlendir.`;

const PROMPT_EN = `You are the content editor for Ascend: Monk Mode discipline app. You're expanding lessons to a 4-layer format.

TASK: Expand the lesson's teaching and quiz fields into a 4-layer structure. DO NOT touch "title", "action", "reflectionPrompt", or "proTip" — keep them as-is.

TEACHING EXPANSION RULES:
- 180-220 words
- 4 layers, in order:
  1. SCENE: A concrete observation the user sees themselves in (phone at night, elevator, queue...). 1-2 paragraphs.
  2. SCIENCE: Real research/figure citation (Huberman, Gloria Mark, Cal Newport, Anna Lembke, Skinner, Kahneman, Marcus Aurelius, BJ Fogg, Lally, Duke, Stanford, Harvard, NYU, MIT, etc.). Include name + year.
  3. MECHANISM: WHY it works — brain/behavior science explanation.
  4. PRACTICE: "What you do today" — concrete.
- Preserve original teaching's essence, just enrich.
- Use **bold** (Markdown) for emphasis.
- Paragraphs separated by \\n\\n.
- English fluent, motivating, direct address ("you").

QUIZ EXPLAIN EXPANSION:
- Expand each quiz item's "explain" to 2-3 sentences (previous 1 sentence was thin).
- Explain WHY the answer is correct + cite research if applicable.
- Use **bold** for emphasis.

OUTPUT FORMAT:
Return ONLY JSON, nothing else. Schema:
{
  "teaching": "...expanded teaching...",
  "quiz": [
    { "q": "...as-is...", "options": [...as-is...], "correct": N, "explain": "...expanded..." },
    ...
  ]
}

Keep q, options, correct EXACTLY as-is. Only strengthen explains.`;

const systemPrompt = lang === "tr" ? PROMPT_TR : PROMPT_EN;

const findCandidates = () => {
  const out = [];
  const pathIds = targetPaths || Object.keys(data.lessons);
  for (const pathId of pathIds) {
    const lessons = data.lessons[pathId];
    if (!lessons) continue;
    for (const lessonId of Object.keys(lessons).sort(
      (a, b) => parseInt(a) - parseInt(b),
    )) {
      const lesson = lessons[lessonId];
      const wc = wordCount(lesson.teaching);
      // Skip already-expanded (>= 150 words) — that's the manual pilot floor.
      if (wc >= 150) continue;
      out.push({ pathId, lessonId, lesson, currentWords: wc });
    }
  }
  return out;
};

const expandOne = async ({ pathId, lessonId, lesson }) => {
  const userMessage = JSON.stringify(
    {
      pathId,
      lessonId,
      currentLesson: lesson,
    },
    null,
    2,
  );
  const response = await client.messages.create({
    model: args.model,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract first text block.
  const block = response.content?.find((b) => b.type === "text");
  if (!block) throw new Error("No text block in Claude response");
  let raw = block.text.trim();
  // Strip Markdown code-fences if Claude wrapped JSON in them.
  if (raw.startsWith("```")) {
    raw = raw
      .replace(/^```(?:json)?\s*/, "")
      .replace(/```\s*$/, "")
      .trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`JSON parse failed: ${e.message}\n--raw--\n${raw.slice(0, 400)}`);
  }
  if (!parsed.teaching || !Array.isArray(parsed.quiz)) {
    throw new Error("Response missing teaching or quiz");
  }
  return parsed;
};

const main = async () => {
  const candidates = findCandidates();
  console.log(
    `Found ${candidates.length} short lessons to expand (lang=${lang})`,
  );
  const slice = candidates.slice(0, maxLessons);
  console.log(`Processing ${slice.length} this run.`);

  let ok = 0;
  let failed = 0;
  for (const c of slice) {
    const { pathId, lessonId, currentWords } = c;
    process.stdout.write(`  ${pathId}/${lessonId} (${currentWords}w) ... `);
    if (dryRun) {
      console.log("(dry-run, skip)");
      continue;
    }
    try {
      const expanded = await expandOne(c);
      // Apply in place — keep original title/action/reflectionPrompt/proTip.
      data.lessons[pathId][lessonId].teaching = expanded.teaching;
      data.lessons[pathId][lessonId].quiz = expanded.quiz;
      const newWords = wordCount(expanded.teaching);
      console.log(`✓ → ${newWords}w`);
      ok++;
      // Persist after EVERY successful expansion so a mid-run failure
      // doesn't lose hours of work. Cheap on disk; JSON is small relative
      // to the API roundtrip cost.
      writeFileSync(lessonsPath, JSON.stringify(data, null, 2) + "\n", "utf8");
    } catch (e) {
      console.log(`✗ ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${ok} expanded, ${failed} failed.`);
  if (failed > 0) process.exit(2);
};

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
