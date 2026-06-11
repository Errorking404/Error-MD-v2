const axios = require('axios');
const FormData = require('form-data');
const fetch = require('node-fetch');

/**
 * Generate text effects using TextPro API
 * @param {string} url - The TextPro effect URL
 * @param {string} text - The text to generate effect
 * @returns {Promise<string>} - The generated image URL
 */
async function generate(url, text) {
    if (!url || !text) throw new Error("Missing URL or Text!");

    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const cookie = response.headers['set-cookie'];
        const form = new FormData();
        form.append('text[]', text);
        form.append('submit', 'GO');

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Cookie': cookie.join('; '),
                ...form.getHeaders()
            },
            body: form
        });

        const resData = await res.text();
        const match = resData.match(/<img src="(.*?)" id="form_value_img"/);

        if (!match || !match[1]) throw new Error("Failed to fetch TextPro image.");

        return match[1].startsWith('http') ? match[1] : `https://textpro.me${match[1]}`;
    } catch (error) {
        console.error("TextPro Error:", error);
        throw new Error("Failed to generate text effect.");
    }
}

module.exports = { generate };