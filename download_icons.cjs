const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const dir = path.join(__dirname, 'public', 'icons8');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// 1. Find all files with img.icons8.com
const cmd = 'findstr /S /M /C:"img.icons8.com" src\\*.jsx';
let files = [];
try {
    const output = execSync(cmd).toString();
    files = output.split('\n').map(f => f.trim()).filter(f => f);
} catch (e) {
    console.error("Error finding files:", e.stdout.toString(), e.stderr.toString());
}

const urlRegex = /https:\/\/img\.icons8\.com\/([a-zA-Z0-9_-]+)\/([0-9]+)\/([a-zA-Z0-9_-]+)\.png/g;
const downloadQueue = new Map(); // filename -> url

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let match;
    let modified = false;
    
    while ((match = urlRegex.exec(content)) !== null) {
        const fullUrl = match[0];
        const style = match[1];
        const size = match[2];
        const name = match[3];
        const filename = `${style}_${size}_${name}.png`;
        
        downloadQueue.set(filename, fullUrl);
        
        // Replace in file
        const newUrl = `/icons8/${filename}`;
        content = content.replace(fullUrl, newUrl);
        modified = true;
    }
    
    if (modified) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});

// Download files
const download = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            } else {
                reject(`Server responded with ${response.statusCode}: ${response.statusMessage}`);
            }
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
};

async function run() {
    for (const [filename, url] of downloadQueue.entries()) {
        const dest = path.join(dir, filename);
        if (!fs.existsSync(dest)) {
            console.log(`Downloading ${url}...`);
            try {
                await download(url, dest);
            } catch (err) {
                console.error(`Failed to download ${url}:`, err);
            }
        }
    }
    console.log("Done!");
}

run();
