const BASE_WEIGHTS = {
  comment_signal: 0.45,
  survey_signal: 0.30,
  responsiveness_signal: 0.25
};

function isValid(v) {
  return v !== null && v !== undefined && !isNaN(v);
}

function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function computeScore(row) {

  const signals = {
    comment_signal: row.comment_signal,
    survey_signal: row.survey_signal,
    responsiveness_signal: row.responsiveness_signal
  };

  // Filter valid signals
  const validEntries = Object.entries(signals)
    .filter(([_, v]) => isValid(v));

  const count = validEntries.length;

  // 🚨 No signals → no score
  if (count === 0) {
    return {
      ...row,
      trust_index_score: null,
      signals_used_count: 0,
      score_type: null
    };
  }

  // Sum weights of available signals
  const totalWeight = validEntries
    .reduce((sum, [key]) => sum + BASE_WEIGHTS[key], 0);

  let score = 0;

  for (const [key, value] of validEntries) {
    const normalisedWeight = BASE_WEIGHTS[key] / totalWeight;
    score += clamp01(value) * normalisedWeight;
  }

  // ✅ NEW SCORE TYPE LOGIC
  let score_type;

  if (count === 3) {
    score_type = "full";
  } else if (count === 2) {
    score_type = "partial";
  } else if (count === 1) {
    score_type = "insufficient";
  }

  return {
    ...row,
    trust_index_score: Number(score.toFixed(4)),
    signals_used_count: count,
    score_type
  };
}

function computeBatch(rows) {
  return rows.map(computeScore);
}

module.exports = { computeBatch };