const axios = require('axios');
const FormData = require('form-data');
const { queryString } = require('object-query-string');

const photoOxy = async (url, text) => {
    try {
        const { data, headers } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 9; Redmi 7A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.99 Mobile Safari/537.36'
            }
        });

        const token = data.match(/<input type="hidden" name="token" value="(.*?)" id="token">/)?.[1];
        const build_server = data.match(/<input type="hidden" name="build_server" value="(.*?)" id="build_server">/)?.[1];
        const build_server_id = data.match(/<input type="hidden" name="build_server_id" value="(.*?)" id="build_server_id">/)?.[1];
        const cookie = headers['set-cookie']?.[0];

        if (!token || !build_server || !build_server_id) {
            throw new Error("Failed to extract required parameters from PhotoOxy.");
        }

        const form = new FormData();
        if (typeof text === 'string') text = [text];
        text.forEach(t => form.append('text[]', t));

        form.append('sumbit', 'GO');
        form.append('token', token);
        form.append('build_server', build_server);
        form.append('build_server_id', build_server_id);

        const postResponse = await axios.post(url, form, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 9; Redmi 7A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.99 Mobile Safari/537.36',
                'Cookie': cookie,
                ...form.getHeaders()
            }
        });

        const form_value = postResponse.data.match(/<div.*?id = "form_value".+>(.*?)<\/div>/)?.[1];
        if (!form_value) {
            throw new Error("Failed to extract form value.");
        }

        const imageResponse = await axios.get(
            `https://photooxy.com/effect/create-image?${queryString(JSON.parse(form_value))}`,
            { headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookie } }
        );

        return build_server + imageResponse.data.image;
    } catch (error) {
        console.error("PhotoOxy Error:", error.message);
        throw new Error("Failed to generate PhotoOxy image.");
    }
};

module.exports.photoOxy = photoOxy;