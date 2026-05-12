const rules = require("./scoringRules")

function average(arr){
  const valid = arr.filter(x => x !== null)
  if(valid.length === 0) return null
  return valid.reduce((a,b)=>a+b,0)/valid.length
}

module.exports = function scoreHostSurvey(data){

  // ---------- TRUST ----------
  const trust = average([
    rules.scoreFrequency(data.commentResponseFrequency),
    rules.scoreYesNo(data.hasOfficialCommunities, 10, 3),
    rules.scoreYesNo(data.hasUnofficialFanCommunities, 10, 5),
    rules.scoreFrequency(data.communityEngagementFrequency),
    rules.scoreYesNo(data.hostsLiveEvents, 10, 3),
    rules.scoreEventType(data.eventType)
  ])

  // ---------- AUDIENCE (HEAVILY WEIGHTED) ----------
  const audience = average([
    rules.scoreYesNo(data.audienceReferencedPurchasing, 10, 0),
    rules.scoreYesNo(data.asksAudienceForSponsorFeedback, 9, 4),
    rules.scoreYesNo(data.hasNewsletter, 6, 2),
    rules.scoreNewsletterPenetration(
      data.newsletterSubscribers,
      data.primaryPlatformFollowers
    ),
    rules.scoreOpenRate(data.newsletterOpenRate)
  ])

  // ---------- SPONSOR ----------
  const sponsor = average([
    rules.scoreYesNo(data.sponsoredBefore, 6, 2),
    rules.scoreYesNo(data.usedOrBelievedProduct, 10, 0),
    rules.scoreConversionRate(data.conversionRate),
    rules.scoreROAS(data.roas),
    rules.scoreYesNo(data.turnedDownSponsorship, 10, 4)
  ])

  // ---------- WEIGHTED COMBINATION ----------
  let final10 =
    (trust * 0.25) +
    (audience * 0.45) +
    (sponsor * 0.30)

  // ---------- HARD PENALTIES ----------
  if (data.usedOrBelievedProduct === "No") {
    final10 *= 0.6   // major trust violation
  }

  if (data.audienceReferencedPurchasing === "No") {
    final10 *= 0.7   // weak audience signal
  }

  // ---------- HARD CAP ----------
  if (data.audienceReferencedPurchasing === "No") {
    final10 = Math.min(final10, 6.5)
  }

  return {
    trustScore: trust,
    audienceScore: audience,
    sponsorScore: sponsor,
    hostSurveyScore10: final10,
    hostSurveyScore100: final10 ? final10 * 10 : null
  }
}