const http = require('http');

const data = JSON.stringify({
    name: '',
    email: '',
    type: 'user'
});

const options = {
    hostname: 'localhost',
    port: 8000,
    path: '/.netlify/functions/waitlist',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`);
    let body = '';
    res.on('data', d => {
        body += d;
    });
    res.on('end', () => {
        console.log('Body:', body);
    });
});

req.on('error', error => {
    console.error(error);
});

req.write(data);
req.end();
