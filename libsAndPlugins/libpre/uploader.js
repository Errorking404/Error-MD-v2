let axios = require('axios');
let BodyForm = require('form-data');
let fs = require('fs');
let cheerio = require('cheerio');

// Function to upload files to Catbox
async function CatBox(filePath) {
	try {
		const fileStream = fs.createReadStream(filePath);
		const formData = new BodyForm();
		formData.append('fileToUpload', fileStream);
		formData.append('reqtype', 'fileupload');
		formData.append('userhash', ''); // You can provide a userhash if needed

		const response = await axios.post('https://catbox.moe/user/api.php', formData, {
			headers: {
				...formData.getHeaders(),
			},
		});

		// Assuming the API returns the file URL as a response
		return response.data;
	} catch (error) {
		console.error("Error at Catbox uploader:", error);
		return "An error occurred while uploading to Catbox.";
	}
}

// Function to upload files to PomfCDN
async function pomfCDN(path) {
	try {
		const fileStream = fs.createReadStream(path);
		const formData = new BodyForm();
		formData.append('files[]', fileStream);

		const response = await axios.post('https://pomf.lain.la/upload.php', formData, {
			headers: {
				...formData.getHeaders(),
			},
		});

		return response.data.files[0].url;
	} catch (error) {
		console.log("Error at pomf uploader in lib/uploader.js:", error);
		return "An error occurred.";
	}
}

// Function to upload files to File.io
async function fileIO(filePath) {
	try {
		// Read the file to upload
		const fileStream = fs.createReadStream(filePath);
		
		// Prepare form data for upload
		const formData = new BodyForm();
		formData.append('file', fileStream);

		// Send POST request to file.io API with form data and headers
		const response = await axios.post('https://file.io/?expires=1d', formData, {
			headers: formData.getHeaders(),
		});
		
		// Handle API response and return the file URL
		if (response.data && response.data.success) {
			return response.data.link;  // Retrieve the file link from the response
		} else {
			throw new Error('File upload failed.');
		}
	} catch (error) {
		console.error('Error at File.io uploader:', error);
		return 'An error occurred while uploading to File.io.';
	}
}

module.exports = { CatBox, pomfCDN, fileIO };