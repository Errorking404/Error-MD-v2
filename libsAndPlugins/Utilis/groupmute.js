module.exports = {
  forwardOrBroadCast: async (jid, message, options = {}) => {
    if (!message?.reply_message?.data) return;
    const quoted = message.reply_message.data;
    const text =
      quoted.message?.conversation ||
      quoted.message?.extendedTextMessage?.text ||
      "";
    if (!text) return;
    return message.sendMessage(text, options);
  },
  muteGroup: async (message) => {
    if (!message?.GroupMuteSettingsChange) return;
    return message.GroupMuteSettingsChange(message.jid, true);
  },
  unmuteGroup: async (message) => {
    if (!message?.GroupMuteSettingsChange) return;
    return message.GroupMuteSettingsChange(message.jid, false);
  },
};
