const axios = require('axios');
const cheerio = require('cheerio');

async function mediafireDl(url) {
    try {
        const res = await axios.get(url);
        const $ = cheerio.load(res.data);

        let link = $('a#downloadButton').attr('href');
        let fileName = $('div.filename').text().trim();
        let fileSize = $('div.info span').eq(1).text().trim();

        if (!link) throw new Error('Failed to fetch download link.');

        return {
            name: fileName || 'Unknown',
            size: fileSize || 'Unknown',
            link: link
        };
    } catch (error) {
        console.error('Error in mediafireDl:', error);
        return null;
    }
}

module.exports = { mediafireDl };