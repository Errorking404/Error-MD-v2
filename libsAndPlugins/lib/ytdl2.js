const yts = require('youtube-yts');
const readline = require('readline');
const ffmpeg = require('fluent-ffmpeg');
const NodeID3 = require('node-id3');
const fs = require('fs');
const { fetchBuffer } = require("./myfunc2");
const ytM = require('node-youtube-music');
const { randomBytes } = require('crypto');
const ytIdRegex = /(?:youtube\.com\/\S*(?:(?:\/e(?:mbed))?\/|watch\?(?:\S*?&?v\=))|youtu\.be\/)([a-zA-Z0-9_-]{6,11})/;
const path = require('path');
const ytDlp = require('yt-dlp');

class YTDownloader {
    constructor() {
        this.tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(this.tmpDir)) {
            fs.mkdirSync(this.tmpDir, { recursive: true });
        }
    }

    isYTUrl = (url) => {
        return ytIdRegex.test(url);
    }

    getVideoID = (url) => {
        if (!this.isYTUrl(url)) throw new Error('is not YouTube URL');
        return ytIdRegex.exec(url)[1];
    }

    WriteTags = async (filePath, Metadata) => {
        NodeID3.write(
            {
                title: Metadata.Title,
                artist: Metadata.Artist,
                originalArtist: Metadata.Artist,
                image: {
                    mime: 'jpeg',
                    type: {
                        id: 3,
                        name: 'front cover',
                    },
                    imageBuffer: (await fetchBuffer(Metadata.Image)).buffer,
                    description: `Cover of ${Metadata.Title}`,
                },
                album: Metadata.Album,
                year: Metadata.Year || ''
            },
            filePath
        );
    }

    search = async (query, options = {}) => {
        const search = await yts.search({ query, hl: 'id', gl: 'ID', ...options });
        return search.videos;
    }

    searchTrack = (query) => {
        return new Promise(async (resolve, reject) => {
            try {
                let ytMusic = await ytM.searchMusics(query);
                let result = [];
                for (let i = 0; i < ytMusic.length; i++) {
                    result.push({
                        isYtMusic: true,
                        title: `${ytMusic[i].title} - ${ytMusic[i].artists.map(x => x.name).join(' ')}`,
                        artist: ytMusic[i].artists.map(x => x.name).join(' '),
                        id: ytMusic[i].youtubeId,
                        url: 'https://youtu.be/' + ytMusic[i].youtubeId,
                        album: ytMusic[i].album,
                        duration: {
                            seconds: ytMusic[i].duration.totalSeconds,
                            label: ytMusic[i].duration.label
                        },
                        image: ytMusic[i].thumbnailUrl.replace('w120-h120', 'w600-h600')
                    });
                }
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }

    downloadMusic = async (query) => {
        try {
            const getTrack = Array.isArray(query) ? query : await this.searchTrack(query);
            const search = getTrack[0];
            
            // Use yt-dlp to get video info
            const videoInfo = await ytDlp.getInfo('https://www.youtube.com/watch?v=' + search.id);
            
            const audioDir = './XeonMedia/audio';
            if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
            let songPath = `${audioDir}/${randomBytes(3).toString('hex')}.mp3`;

            // Download audio using yt-dlp
            await new Promise((resolve, reject) => {
                ytDlp.download('https://www.youtube.com/watch?v=' + search.id, {
                    output: songPath,
                    audioFormat: 'mp3',
                    audioQuality: 140,
                })
                .then(() => resolve())
                .catch(reject);
            });

            await this.WriteTags(songPath, { Title: search.title, Artist: search.artist, Image: search.image, Album: search.album, Year: videoInfo.publishDate.split('-')[0] });
            
            return {
                meta: search,
                path: songPath,
                size: fs.statSync(songPath).size
            };
        } catch (error) {
            throw new Error(error);
        }
    }

    mp4 = async (query, quality = 'highest') => {
        try {
            if (!query) throw new Error('Video ID or YouTube Url is required');
            const videoId = this.isYTUrl(query) ? this.getVideoID(query) : query;
            
            const videoInfo = await ytDlp.getInfo('https://www.youtube.com/watch?v=' + videoId);
            
            // Find best video+audio format
            const formats = ytDlp.filterFormats(videoInfo.formats, 'videoandaudio');
            const format = formats[0]; // Get first (best) format
            
            return {
                title: videoInfo.title,
                thumb: videoInfo.thumbnails[videoInfo.thumbnails.length - 1],
                date: videoInfo.publishDate,
                duration: videoInfo.durationSeconds,
                channel: videoInfo.author,
                quality: format.qualityLabel || 'highest',
                contentLength: format.contentLength,
                description: videoInfo.description,
                videoUrl: format.url
            };
        } catch (error) {
            throw error;
        }
    }

    mp3 = async (url, metadata = {}, autoWriteTags = false) => {
        try {
            if (!url) throw new Error('Video ID or YouTube Url is required');
            url = this.isYTUrl(url) ? 'https://www.youtube.com/watch?v=' + this.getVideoID(url) : url;
            
            const videoInfo = await ytDlp.getInfo(url);
            const audioDir = './XeonMedia/audio';
            if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
            let songPath = `${audioDir}/${randomBytes(3).toString('hex')}.mp3`;

            // Download using yt-dlp
            await ytDlp.download(url, {
                output: songPath,
                audioFormat: 'mp3',
                audioQuality: 140,
            });

            let starttime = Date.now();
            
            if (Object.keys(metadata).length !== 0) {
                await this.WriteTags(songPath, metadata);
            }
            if (autoWriteTags) {
                await this.WriteTags(songPath, { Title: videoInfo.title, Album: videoInfo.author, Year: videoInfo.publishDate.split('-')[0], Image: videoInfo.thumbnails[videoInfo.thumbnails.length - 1].url });
            }
            
            return {
                meta: {
                    title: videoInfo.title,
                    channel: videoInfo.author,
                    seconds: videoInfo.durationSeconds,
                    image: videoInfo.thumbnails[videoInfo.thumbnails.length - 1].url
                },
                path: songPath,
                size: fs.statSync(songPath).size
            };
        } catch (error) {
            throw error;
        }
    }

    async mp3(url) {
        try {
            const info = await ytDlp.getInfo(url);
            
            const fileName = `${Date.now()}.mp3`;
            const filePath = path.join(this.tmpDir, fileName);

            await ytDlp.download(url, {
                output: filePath,
                audioFormat: 'mp3',
                audioQuality: 'highestaudio',
            });

            return {
                path: filePath,
                meta: {
                    title: info.title,
                    thumbnail: info.thumbnails[0].url
                }
            };
        } catch (error) {
            console.error('Error downloading audio:', error);
            throw error;
        }
    }
}

module.exports = new YTDownloader();

