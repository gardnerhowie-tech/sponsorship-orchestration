function normalizeTallyPayload(payload) {
  const fields = payload?.data?.fields || [];

  function getValueByLabel(label) {
    const field = fields.find(f => f.label && f.label.trim() === label);
    return field ? field.value : null;
  }

  const channel_url = getValueByLabel("YouTube Channel URL (must be /channel/ format)");

  const channel_id = extractChannelId(channel_url);

  return {
    channel_url,
    channel_id,

    commentResponseFrequency: getText(fields, "How frequently do you respond to audience comments?"),
    hasOfficialCommunities: getText(fields, "Do you have official communities?"),
    hasUnofficialFanCommunities: getText(fields, "Are there unofficial fan communities?"),
    communityEngagementFrequency: getText(fields, "How frequently do you engage with your community?"),
    hostsLiveEvents: getText(fields, "Do you host live events?"),
    eventType: getText(fields, "Event type"),

    audienceReferencedPurchasing: getText(fields, "Have audience members referenced purchasing something you recommended?"),
    asksAudienceForSponsorFeedback: getText(fields, "Do you ask your audience for feedback on sponsors?"),
    hasNewsletter: getText(fields, "Do you have a newsletter?"),
    newsletterSubscribers: safeNumber(getValueByLabel("Newsletter subscribers")),
    newsletterOpenRate: safeNumber(getValueByLabel("Average open rate")),
    primaryPlatformFollowers: safeNumber(getValueByLabel("Total followers on primary platform")),

    sponsoredBefore: getText(fields, "Have you had sponsors before?"),
    usedOrBelievedProduct: getText(fields, "Did you personally use or believe in the product you sponsored?"),
    conversionRate: safeNumber(getValueByLabel("Conversion rate (if tracked)")),
    roas: safeNumber(getValueByLabel("ROAS (if tracked)")),
    turnedDownSponsorship: getText(fields, "Have you ever turned down a sponsorship?")
  };
}

// ---------- FIXED CHANNEL ID EXTRACTION ----------

function extractChannelId(url) {
  if (!url) return null;

  try {
    const clean = url.trim();

    // strict regex for /channel/UC...
    const match = clean.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/);

    if (match && match[1]) {
      return match[1];
    }

    return null;

  } catch {
    return null;
  }
}

// ---------- helpers ----------

function safeNumber(val) {
  if (val === null || val === undefined || val === "") return null;
  return Number(val);
}

function getText(fields, label) {
  const field = fields.find(f => f.label && f.label.trim() === label);

  if (!field) return null;

  if (field.options && field.value) {
    const selected = field.options.find(o => field.value.includes(o.id));
    return selected ? selected.text : null;
  }

  return field.value || null;
}

module.exports = normalizeTallyPayload;