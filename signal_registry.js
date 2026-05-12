module.exports = {
  COMMENT_ANALYSIS: {
    sheet: "COMMENT_ANALYSIS",
    column: "overall_comment_signal",
    weight: 0.60,
    scale: "0-1"
  },

  HOST_SURVEY: {
    sheet: "HOST_SURVEY_PIPELINE",
    column: "survey_signal",
    weight: 0.18,
    scale: "0-100"
  },

  HOST_RESPONSIVENESS: {
    sheet: "HOST_RESPONSIVENESS",
    column: "host_responsiveness_score",
    weight: 0.10,
    scale: "0-100",
    latest_by_timestamp: true
  },

  LIVE_EVENTS: {
    sheet: "LIVE_EVENTS",
    column: "live_events_signal",
    weight: 0.12,
    scale: "0-100",
    optional: true
  }
};