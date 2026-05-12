function pctAbove(data, field, threshold = 0.5) {
  const count = data.filter(r => r[field] >= threshold).length;
  return count / data.length;
}

function pctPositiveSentiment(data) {
  const positive = data.filter(r => r.sentiment >= 0.6).length;
  const negative = data.filter(r => r.sentiment <= 0.4).length;

  return {
    positive_pct: positive / data.length,
    negative_pct: negative / data.length
  };
}

/* ---------- BAND SCORING ---------- */

function sentimentBand(positive, negative) {
  if (positive > 0.85) return 10;
  if (positive > 0.70) return 8;
  if (positive > 0.50) return 6;
  if (negative > 0.30) return 2;
  if (negative > 0.15) return 4;
  return 6;
}

function depthBand(pct) {
  if (pct > 0.50) return 10;
  if (pct > 0.35) return 8;
  if (pct > 0.20) return 6;
  if (pct > 0.10) return 4;
  return 2;
}

function parasocialBand(pct) {
  if (pct > 0.40) return 10;
  if (pct > 0.30) return 8;
  if (pct > 0.20) return 6;
  if (pct > 0.10) return 4;
  return 2;
}

function behaviourBand(pct) {
  if (pct > 0.25) return 10;
  if (pct > 0.18) return 8;
  if (pct > 0.12) return 6;
  if (pct > 0.06) return 4;
  return 2;
}

function substantiveBand(pct) {
  if (pct > 0.40) return 10;
  if (pct > 0.30) return 8;
  if (pct > 0.20) return 6;
  if (pct > 0.10) return 4;
  return 2;
}

function returningBand(pct) {
  if (pct > 0.35) return 10;
  if (pct > 0.25) return 8;
  if (pct > 0.15) return 6;
  if (pct > 0.08) return 4;
  return 2;
}

function audienceBand(pct) {
  if (pct > 0.30) return 10;
  if (pct > 0.20) return 8;
  if (pct > 0.12) return 6;
  if (pct > 0.05) return 4;
  return 2;
}

/* ---------- MAIN AGGREGATION ---------- */

function computeCommentScore(classifications, interactionRatio) {

  const sentimentStats = pctPositiveSentiment(classifications);

  const depthPct = pctAbove(classifications, "depth");
  const parasocialPct = pctAbove(classifications, "parasocial");
  const behaviourPct = pctAbove(classifications, "behavioural_change");
  const substantivePct = pctAbove(classifications, "substantive_engagement");
  const returningPct = pctAbove(classifications, "returning_listener");

  const sentimentScore = sentimentBand(
    sentimentStats.positive_pct,
    sentimentStats.negative_pct
  );

  const depthScore = depthBand(depthPct);
  const parasocialScore = parasocialBand(parasocialPct);
  const behaviourScore = behaviourBand(behaviourPct);
  const substantiveScore = substantiveBand(substantivePct);
  const returningScore = returningBand(returningPct);
  const audienceScore = audienceBand(interactionRatio);

  const composite =
      sentimentScore * 0.10 +
      depthScore * 0.13 +
      parasocialScore * 0.17 +
      behaviourScore * 0.18 +
      substantiveScore * 0.15 +
      returningScore * 0.12 +
      audienceScore * 0.15;

  return {
    sentimentScore,
    depthScore,
    parasocialScore,
    behaviourScore,
    substantiveScore,
    returningScore,
    audienceScore,
    compositeInternal: composite,
    compositeDisplay: composite * 10,

    sentiment_positive_pct: sentimentStats.positive_pct,
    depth_deep_pct: depthPct,
    parasocial_yes_pct: parasocialPct,
    behaviour_yes_pct: behaviourPct,
    substantive_yes_pct: substantivePct,
    returning_yes_pct: returningPct
  };
}

module.exports = {
  computeCommentScore
};
