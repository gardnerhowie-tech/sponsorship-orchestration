function computeAudienceInteraction(rawComments) {
  const topLevelComments = rawComments.filter(c => !c.is_reply);

  if (topLevelComments.length === 0) {
    return {
      interactionRate: 0,
      commentsWithReplies: 0,
      totalTopLevelComments: 0
    };
  }

  let commentsWithReplies = 0;

  for (const comment of topLevelComments) {
    if (comment.reply_count && comment.reply_count > 0) {
      commentsWithReplies += 1;
    }
  }

  const interactionRate =
    commentsWithReplies / topLevelComments.length;

  return {
    interactionRate,
    commentsWithReplies,
    totalTopLevelComments: topLevelComments.length
  };
}

module.exports = {
  computeAudienceInteraction
};
