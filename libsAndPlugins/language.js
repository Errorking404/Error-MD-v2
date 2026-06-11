const { formatTemplate, createLangValue } = require("./Utilis/format");

const STRINGS = {
  admin: {
    BAN_DESC: "Kick a user from the group",
    IM_NOT_ADMIN: "*I am not an admin in this group.*",
    REMOVE_ALL: "*Removing all non-admin members in 10 seconds...*",
    GIVE_ME_USER: "*Mention or reply to a user.*",
    IS_ADMIN: "*Cannot kick a group admin.*",
    BANNED: "*Kicked @{}*",
    ADD_DESC: "Add a user to the group",
    FAILED: "*Failed to add user. Invite sent instead.*",
    ADDED: "*Added @{} to the group.*",
    PROMOTE_DESC: "Promote a user to admin",
    ALREADY_PROMOTED: "*User is already an admin.*",
    PROMOTED: "*Promoted @{} to admin.*",
    DEMOTE_DESC: "Demote a user from admin",
    ALREADY_NOT_ADMIN: "*User is not an admin.*",
    DEMOTED: "*Demoted @{} from admin.*",
    MUTE_DESC: "Mute the group",
    MUTED: "*Group has been muted.*",
    TMUTE: "*Group muted for ",
    UNMUTED: "*Group has been unmuted.*",
    UNMUTE_DESC: "Unmute the group",
    INVITE_DESC: "Get group invite link or info",
    COMMON_DESC: "Find common members between two groups",
    SYNTAX: "*Usage: .common <groupJid1> <groupJid2>*",
    INVALID_JID: "*Invalid group JID.*",
    DIFF_DESC: "Find different members between two groups",
    REVOKE_DESC: "Revoke group invite link",
    REVOKE: "*Invite link has been revoked.*",
    INVITE: "*Group invite link:*\nhttps://chat.whatsapp.com/{}",
  },
  _asena: {
    DESC: "Enable or disable Lydia AI chat",
    L_NOT_ACTIVATED: "*Lydia is not active for {}.*",
    L_DEACTIVATED: "*Lydia deactivated for {}.*",
    L_ACTIVATED: "*Lydia activated for {}.*",
  },
  sticker: {
    STICKER_DESC: "Create sticker from image/video",
    NEED_IMAGE: "*Reply to an image or video.*",
    NEED_REPLY: "*Reply to a media message.*",
    MP4_DESC: "Convert animated sticker to MP4",
    MP4_NEED_REPLY: "*Reply to an animated sticker.*",
    TAKE_DESC: "Rebrand sticker or audio metadata",
  },
  profile: {
    PROFILE_DESC: "Show user profile info",
    BLOCK_DESC: "Block a user",
    UNBLOCK_DESC: "Unblock a user",
    SETPP_DESC: "Set profile picture",
    SETSTATUS_DESC: "Set status",
    LEAVE_DESC: "Leave a group",
  },
  groupmute: {
    MUTE_DESC: "Mute group for everyone",
    UNMUTE_DESC: "Unmute group",
  },
  system_stats: {
    ALIVE_DESC: "Check if bot is alive",
    PING_DESC: "Check bot latency",
    WARN_DESC: "Warn a user",
  },
  weather: {
    WEATHER_DESC: "Get weather info",
    NEED_CITY: "*Please provide a city name.*",
  },
  twitter: {
    PIN_DESC: "Download pinned tweet media",
    NEED_URL: "*Please provide a Twitter/X URL.*",
  },
  media: {
    PLAY_DESC: "Play YouTube audio",
    VIDEO_DESC: "Download YouTube video",
    SONG_DESC: "Download song",
    NEED_QUERY: "*Please provide a search query or URL.*",
  },
  filters: {
    FILTER_DESC: "Set a text filter",
    FILTER_NEED: "*Usage: .filter <keyword> | <response>*",
    FILTER_DEL: "Delete a filter",
    FILTER_LIST: "List all filters",
    NO_FILTER: "*No filters set for this chat.*",
    FILTERS: "*Active filters:*",
    NEED_REPLY: "*Invalid syntax.*",
    FILTERED: "*Filter saved for:* {}",
    STOP_DESC: "Remove a text filter",
    ALREADY_NO_FILTER: "*Filter not found.*",
    DELETED: "*Filter removed.*",
  },
  web: {
    SCHEDULE_DESC: "Schedule a message",
    PING_DESC: "Ping a website",
    NEED_URL: "*Please provide a URL.*",
  },
  removebg: {
    REMOVEBG_DESC: "Remove image background",
    NEED_IMAGE: "*Reply to an image.*",
    NEED_KEY: "*Remove.bg API key is not configured.*",
  },
  _plugin: {
    INSTALL_DESC: "Install a plugin",
    REMOVE_DESC: "Remove a plugin",
    NEED_URL: "*Please provide a plugin URL.*",
  },
  scrapers: {
    YT_DESC: "YouTube search",
    GOOGLE_DESC: "Google search",
    WIKI_DESC: "Wikipedia search",
    NEED_QUERY: "*Please provide a search query.*",
  },
  insta: {
    INSTA_DESC: "Download Instagram media",
    NEED_URL: "*Please provide an Instagram URL.*",
  },
  docx: {
    DOC_DESC: "Document tools",
    NEED_REPLY: "*Reply to a document.*",
  },
  ocr: {
    OCR_DESC: "Extract text from image",
    NEED_IMAGE: "*Reply to an image.*",
  },
  afk: {
    AFK_DESC: "Set AFK status",
    AFK_OFF: "Disable AFK",
    AFK_ON: "*AFK mode enabled.*",
  },
  greetings: {
    WELCOME_DESC: "Configure welcome messages",
    GOODBYE_DESC: "Configure goodbye messages",
    MENTION_DESC: "Configure mention messages",
  },
  tiktok: {
    TIKTOK_DESC: "Download TikTok video",
    NEED_URL: "*Please provide a TikTok URL.*",
  },
  memes: {
    MEME_DESC: "Get a random meme",
  },
  updown: {
    UPLOAD_DESC: "Upload media",
    DOWNLOAD_DESC: "Download media",
    STATUS_DESC: "Get user status",
  },
  tagall: {
    TAGALL_DESC: "Tag all group members",
  },
  nekobin: {
    NEKO_DESC: "Upload text to Nekobin",
    NEED_TEXT: "*Please provide text to upload.*",
  },
  heroku: {
    HEROKU_DESC: "Heroku app management",
    NEED_CONFIG: "*Heroku credentials are not configured.*",
  },
};

function wrapString(value) {
  const text = String(value ?? "");
  return {
    format: (...args) => formatTemplate(text, args),
    toString: () => text,
    valueOf: () => text,
    [Symbol.toPrimitive]: () => text,
  };
}

module.exports = {
  getString(namespace = "") {
    const strings = STRINGS[namespace] || {};
    return new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "toString") return () => namespace;
          if (prop === Symbol.toPrimitive) return () => namespace;
          if (Object.prototype.hasOwnProperty.call(strings, prop)) {
            return wrapString(strings[prop]);
          }
          return createLangValue(`${namespace}.${String(prop)}`);
        },
      }
    );
  },
};
