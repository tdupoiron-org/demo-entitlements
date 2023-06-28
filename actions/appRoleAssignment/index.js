const axios = require('axios');
const core = require('@actions/core');

const RESOURCE = 'https://graph.microsoft.com';
const AUTHORITY_HOST_URL = 'https://login.microsoftonline.com';

// Read inputs from workflow file
const CLIENT_ID = core.getInput('CLIENT_ID');
const CLIENT_SECRET = core.getInput('CLIENT_SECRET');
const TENANT_ID = core.getInput('TENANT_ID');

// Function to get access token
async function getAccessToken() {

    const data = `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&resource=${RESOURCE}`;
    const config = {
        headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
        }
    };
    try {
        const response = await axios.post(`${AUTHORITY_HOST_URL}/${TENANT_ID}/oauth2/token`, data, config);
        return response.data.access_token;
    } catch (error) {
        console.log(error);
        return error;
    }
};

getAccessToken().then((token) => {
    console.log(token);
});