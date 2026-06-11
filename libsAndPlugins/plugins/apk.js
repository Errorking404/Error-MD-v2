const Asena = require("../Utilis/events");
const axios = require('axios');

Asena.addCommand(
  { pattern: "apk ?(.*)", desc: "Download APK from NexOracle" },
  async (message, match) => {
    const appName = match.trim();
    if (!appName) {
      return await message.sendMessage('⚠️ Please provide an app name. Example: `.apk whatsapp`');
    }

    try {
      await message.sendMessage('⏳ Searching for ' + appName + '...');

      const apiUrl = 'https://api.nexoracle.com/downloader/apk';
      const params = {
        apikey: 'free_key@maher_apis',
        q: appName,
      };

      const response = await axios.get(apiUrl, { params });

      if (!response.data || response.data.status !== 200 || !response.data.result) {
        return await message.sendMessage('❌ Unable to find the APK. Please try again later.');
      }

      const { name, lastup, package, size, icon, dllink } = response.data.result;

      await message.sendMessage(`📦 *APK Found: ${name}*\n\nDownloading...`);

      const apkResponse = await axios.get(dllink, { responseType: 'arraybuffer' });
      if (!apkResponse.data) {
        return await message.sendMessage('❌ Failed to download the APK. Please try again later.');
      }

      const apkBuffer = Buffer.from(apkResponse.data, 'binary');

      const details = `📦 *APK Details* 📦\n\n` +
        `🔖 *Name*: ${name}\n` +
        `📅 *Last Update*: ${lastup}\n` +
        `📦 *Package*: ${package}\n` +
        `📏 *Size*: ${size}\n\n` +
        `> © POWERED BY Error-MD`;

      await message.sendMessage(details);
      await message.sendMessage(apkBuffer, { filename: `${name}.apk`, mimetype: 'application/vnd.android.package-archive' }, 'document');

    } catch (error) {
      console.error('❌ Error in apkCommand:', error);
      await message.sendMessage('❌ Unable to fetch APK details. Please try again later.');
    }
  }
);
